import "server-only";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { analyzeUrl } from "@/server/crawler";
import type { Result, UrlAnalysis } from "@/server/crawler/types";
import { scoreSite, SCORING_VERSION, type PageInput, type ScoringContext, type ScoringResult } from "@/server/scoring";
import { saveAuditResult } from "@/server/services/audit-results";

/** Limite d'audits lancés par utilisateur sur 24 heures (protection contre les abus). */
export const MAX_AUDITS_PER_DAY = 20;
/** Un audit « en cours » depuis plus longtemps est considéré comme abandonné. */
const RUNNING_STALE_MS = 2 * 60 * 1000;

export type LaunchError = "NOT_FOUND" | "DEMO_PROJECT" | "QUOTA" | "ALREADY_RUNNING" | "INTERNAL";

export type AuditDeps = {
  /** Analyse d'une URL (remplaçable dans les tests). */
  analyze?: (url: string) => Promise<Result<UrlAnalysis>>;
};

/**
 * Audit de la page d'accueil d'un projet : analyse (crawler) → score (moteur pur) → enregistrement.
 * MVP : une seule page, exécutée pendant la requête (≈ 15 s maximum). Un worker prendra le relais
 * pour l'analyse de plusieurs pages.
 */
export async function runHomepageAudit(
  userId: string,
  projectId: string,
  deps: AuditDeps = {},
): Promise<{ ok: true; auditId: string } | { ok: false; error: LaunchError }> {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return { ok: false, error: "NOT_FOUND" };
  if (project.isDemo) return { ok: false, error: "DEMO_PROJECT" };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.audit.count({ where: { project: { userId }, queuedAt: { gte: since } } });
  if (recent >= MAX_AUDITS_PER_DAY) return { ok: false, error: "QUOTA" };

  const running = await prisma.audit.findFirst({
    where: { projectId, status: { in: ["QUEUED", "RUNNING"] }, queuedAt: { gte: new Date(Date.now() - RUNNING_STALE_MS) } },
  });
  if (running) return { ok: false, error: "ALREADY_RUNNING" };

  const context: ScoringContext = {
    companyName: project.companyName,
    sector: project.sector,
    primaryTarget: project.primaryTarget,
    city: project.city,
    country: project.country,
    geoQueries: project.geoQueries,
  };

  const audit = await prisma.audit.create({
    data: {
      projectId,
      status: "RUNNING",
      startedAt: new Date(),
      scoringVersion: SCORING_VERSION,
      inputSnapshot: { siteUrl: project.siteUrl, ...context, competitors: project.competitors },
    },
  });

  try {
    const analysis = await (deps.analyze ?? analyzeUrl)(project.siteUrl);
    const pages: PageInput[] = [
      analysis.ok
        ? { role: "home", url: project.siteUrl, ok: true, analysis: analysis.value }
        : { role: "home", url: project.siteUrl, ok: false, error: analysis.error },
    ];
    const result = scoreSite({ context, pages, site: {} });
    await prisma.$transaction((tx) => saveAuditResult(tx, audit.id, pages, result));
    return { ok: true, auditId: audit.id };
  } catch (error) {
    logger.error("audit.run_failed", { auditId: audit.id, error });
    await prisma.audit.update({ where: { id: audit.id }, data: { status: "FAILED", finishedAt: new Date(), errorCode: "INTERNAL" } });
    return { ok: false, error: "INTERNAL" };
  }
}

export async function listAudits(userId: string, projectId: string) {
  return prisma.audit.findMany({
    where: { projectId, project: { userId } },
    orderBy: { queuedAt: "desc" },
    select: { id: true, status: true, scoreTotal: true, queuedAt: true, finishedAt: true, isDemo: true },
  });
}

/** Rapport d'un audit, uniquement pour le propriétaire du projet. */
export async function getAuditReport(userId: string, auditId: string) {
  const audit = await prisma.audit.findFirst({
    where: { id: auditId, project: { userId } },
    include: { project: { select: { id: true, companyName: true, siteUrl: true, isDemo: true } } },
  });
  if (!audit) return null;
  const snapshot = audit.reportSnapshot as ScoringResult | null;
  const report = snapshot && typeof snapshot === "object" && snapshot.scoringVersion?.startsWith("cite-") ? snapshot : null;
  return { audit, project: audit.project, report };
}
