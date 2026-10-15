import "server-only";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { crawlSite, type CrawlOptions, type SiteCrawl } from "@/server/crawler";
import { sendEmail, type OutgoingEmail } from "@/server/email/send";
import { auditFinishedEmail } from "@/server/email/templates";
import { reportProgress } from "@/server/jobs/queue";
import { scoreSite, type ScoringContext } from "@/server/scoring";
import { saveAuditResult } from "@/server/services/audit-results";

export type ProcessDeps = {
  /** Exploration du site (remplaçable dans les tests). */
  crawl?: (url: string, options: CrawlOptions) => Promise<SiteCrawl>;
  /** Envoi de l'e-mail « audit terminé » (remplaçable dans les tests). */
  sendEmail?: (email: OutgoingEmail) => Promise<{ ok: boolean }>;
  /** Adresse publique de l'application, pour le lien du rapport. */
  appUrl?: string;
};

type Snapshot = ScoringContext & { siteUrl: string };

function readSnapshot(value: unknown): Snapshot | null {
  const v = value as Partial<Snapshot> | null;
  if (!v || typeof v.siteUrl !== "string" || typeof v.companyName !== "string") return null;
  return {
    siteUrl: v.siteUrl,
    companyName: v.companyName,
    sector: v.sector ?? "",
    primaryTarget: v.primaryTarget ?? "",
    city: v.city ?? null,
    country: v.country ?? "",
    geoQueries: Array.isArray(v.geoQueries) ? v.geoQueries.filter((q): q is string => typeof q === "string") : [],
  };
}

/**
 * Traite un audit déjà pris en charge (status RUNNING) : exploration → score → enregistrement.
 * Les paramètres viennent de la copie figée au lancement (inputSnapshot), pas du projet actuel.
 */
export async function processAudit(auditId: string, deps: ProcessDeps = {}): Promise<void> {
  const audit = await prisma.audit.findUnique({ where: { id: auditId } });
  if (!audit || audit.isDemo || audit.status !== "RUNNING") return;

  const snapshot = readSnapshot(audit.inputSnapshot);
  if (!snapshot) {
    await prisma.audit.update({ where: { id: auditId }, data: { status: "FAILED", finishedAt: new Date(), errorCode: "INVALID_INPUT" } });
    return;
  }

  try {
    const crawl = await (deps.crawl ?? crawlSite)(snapshot.siteUrl, {
      onProgress: (progress) => reportProgress(auditId, progress),
    });
    const { siteUrl, ...context } = snapshot;
    void siteUrl;
    const result = scoreSite({
      context,
      pages: crawl.pages,
      site: {
        sitemap: crawl.sitemap ?? undefined,
        brokenLinks: crawl.brokenLinks ?? undefined,
      },
    });
    await prisma.$transaction(async (tx) => {
      // Une reprise après arrêt du worker ne doit pas dupliquer les lignes.
      await tx.pageAnalysis.deleteMany({ where: { auditId } });
      await tx.finding.deleteMany({ where: { auditId } });
      await saveAuditResult(tx, auditId, crawl.pages, result);
      await tx.audit.update({
        where: { id: auditId },
        data: { progress: { phase: "done", pagesDone: crawl.pages.length, pagesTotal: crawl.pages.length, skipped: crawl.skipped.length } },
      });
    });
    logger.info("audit.processed", { auditId, pages: crawl.pages.length, score: result.scoreTotal });
  } catch (error) {
    await markFailed(auditId, error);
    return;
  }
  await notifyAuditFinished(auditId, deps);
}

async function markFailed(auditId: string, error: unknown) {
  // updateMany : ne lève pas d'erreur si le projet (et donc l'audit) a été supprimé entre-temps.
  const { count } = await prisma.audit.updateMany({
    where: { id: auditId },
    data: { status: "FAILED", finishedAt: new Date(), errorCode: "INTERNAL" },
  });
  if (count === 0) logger.info("audit.deleted_during_processing", { auditId });
  else logger.error("audit.process_failed", { auditId, error });
}

/**
 * Prévient l'utilisateur que son audit est terminé. Un échec d'envoi est journalisé
 * mais ne change jamais le résultat de l'audit.
 */
async function notifyAuditFinished(auditId: string, deps: ProcessDeps): Promise<void> {
  try {
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      select: {
        status: true,
        isDemo: true,
        scoreTotal: true,
        projectId: true,
        project: { select: { companyName: true, user: { select: { name: true, email: true } } } },
      },
    });
    if (!audit || audit.isDemo || (audit.status !== "SUCCEEDED" && audit.status !== "PARTIAL")) return;
    const appUrl = deps.appUrl ?? getServerEnv().BETTER_AUTH_URL;
    const content = auditFinishedEmail({
      name: audit.project.user.name,
      companyName: audit.project.companyName,
      score: audit.scoreTotal,
      url: `${appUrl.replace(/\/$/, "")}/projects/${audit.projectId}/audits/${auditId}`,
    });
    const { ok } = await (deps.sendEmail ?? sendEmail)({ to: audit.project.user.email, ...content });
    if (!ok) logger.error("audit.notify_failed", { auditId });
  } catch (error) {
    logger.error("audit.notify_failed", { auditId, error });
  }
}
