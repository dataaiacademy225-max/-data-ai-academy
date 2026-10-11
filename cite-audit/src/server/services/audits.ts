import "server-only";
import { prisma } from "@/lib/db";
import { SCORING_VERSION, type ScoringContext, type ScoringResult } from "@/server/scoring";

/** Limite d'audits lancés par utilisateur sur 24 heures (protection contre les abus). */
export const MAX_AUDITS_PER_DAY = 20;
/** Un audit en attente depuis plus longtemps est considéré comme abandonné (worker absent). */
export const QUEUED_STALE_MS = 30 * 60 * 1000;

export type LaunchError = "NOT_FOUND" | "DEMO_PROJECT" | "QUOTA" | "ALREADY_RUNNING";

/**
 * Demande d'audit : vérifie les droits et les limites, puis place l'audit en file d'attente.
 * Le worker (`pnpm worker`) explore ensuite jusqu'à 15 pages, calcule le score et enregistre le rapport.
 */
export async function requestAudit(
  userId: string,
  projectId: string,
): Promise<{ ok: true; auditId: string } | { ok: false; error: LaunchError }> {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return { ok: false, error: "NOT_FOUND" };
  if (project.isDemo) return { ok: false, error: "DEMO_PROJECT" };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.audit.count({ where: { project: { userId }, queuedAt: { gte: since } } });
  if (recent >= MAX_AUDITS_PER_DAY) return { ok: false, error: "QUOTA" };

  // Un audit resté en attente trop longtemps est annulé pour ne pas bloquer le projet.
  await prisma.audit.updateMany({
    where: { projectId, status: "QUEUED", queuedAt: { lt: new Date(Date.now() - QUEUED_STALE_MS) } },
    data: { status: "CANCELED", finishedAt: new Date(), errorCode: "QUEUE_TIMEOUT" },
  });
  const pending = await prisma.audit.findFirst({ where: { projectId, status: { in: ["QUEUED", "RUNNING"] } } });
  if (pending) return { ok: false, error: "ALREADY_RUNNING" };

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
      status: "QUEUED",
      scoringVersion: SCORING_VERSION,
      progress: { phase: "queued", pagesDone: 0, pagesTotal: 0 },
      // Copie figée : modifier le projet ensuite ne change pas cet audit.
      inputSnapshot: { siteUrl: project.siteUrl, ...context, competitors: project.competitors },
    },
  });
  return { ok: true, auditId: audit.id };
}

export async function listAudits(userId: string, projectId: string) {
  return prisma.audit.findMany({
    where: { projectId, project: { userId } },
    orderBy: { queuedAt: "desc" },
    select: { id: true, status: true, scoreTotal: true, queuedAt: true, finishedAt: true, isDemo: true, progress: true },
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
  // Durée d'attente calculée ici (et non pendant le rendu) pour l'affichage de la progression.
  return { audit, project: audit.project, report, queuedForMs: Date.now() - audit.queuedAt.getTime() };
}
