import "server-only";
import { prisma } from "@/lib/db";
import { SCORING_VERSION, type ScoringContext, type ScoringResult } from "@/server/scoring";
import { lockForTransaction } from "@/server/services/locks";

/** Limite d'audits lancés par utilisateur sur 24 heures (protection contre les abus). */
export const MAX_AUDITS_PER_DAY = 20;
/** Un audit en attente depuis plus longtemps est considéré comme abandonné (worker absent). */
export const QUEUED_STALE_MS = 30 * 60 * 1000;

/** Audits du site du projet seulement (les audits de concurrents ont un comparisonId). */
export const OWN_AUDIT = { comparisonId: null } as const;

export type LaunchError = "NOT_FOUND" | "DEMO_PROJECT" | "QUOTA" | "ALREADY_RUNNING";

/**
 * Demande d'audit : vérifie les droits et les limites, puis place l'audit en file d'attente.
 * Le worker (`pnpm worker`) explore ensuite jusqu'à 15 pages, calcule le score et enregistre le rapport.
 */
export async function requestAudit(
  userId: string,
  projectId: string,
  /** null = pas de limite par jour (compte propriétaire). Les autres protections restent actives. */
  options: { dailyLimit?: number | null } = {},
): Promise<{ ok: true; auditId: string } | { ok: false; error: LaunchError }> {
  // Vérifications et création dans une même transaction, sous verrou par utilisateur :
  // deux demandes simultanées ne peuvent ni créer deux audits ni dépasser le quota.
  return prisma.$transaction(async (tx) => {
    await lockForTransaction(tx, `audit-request:${userId}`);

    const project = await tx.project.findFirst({ where: { id: projectId, userId } });
    if (!project) return { ok: false as const, error: "NOT_FOUND" as const };
    if (project.isDemo) return { ok: false as const, error: "DEMO_PROJECT" as const };

    const dailyLimit = options.dailyLimit === undefined ? MAX_AUDITS_PER_DAY : options.dailyLimit;
    if (dailyLimit !== null) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = await tx.audit.count({ where: { project: { userId }, queuedAt: { gte: since } } });
      if (recent >= dailyLimit) return { ok: false as const, error: "QUOTA" as const };
    }

    // Un audit resté en attente trop longtemps est annulé pour ne pas bloquer le projet.
    await tx.audit.updateMany({
      where: { projectId, status: "QUEUED", queuedAt: { lt: new Date(Date.now() - QUEUED_STALE_MS) } },
      data: { status: "CANCELED", finishedAt: new Date(), errorCode: "QUEUE_TIMEOUT" },
    });
    const pending = await tx.audit.findFirst({ where: { projectId, ...OWN_AUDIT, status: { in: ["QUEUED", "RUNNING"] } } });
    if (pending) return { ok: false as const, error: "ALREADY_RUNNING" as const };

    const context: ScoringContext = {
      companyName: project.companyName,
      sector: project.sector,
      primaryTarget: project.primaryTarget,
      city: project.city,
      country: project.country,
      geoQueries: project.geoQueries,
    };
    const audit = await tx.audit.create({
      data: {
        projectId,
        status: "QUEUED",
        scoringVersion: SCORING_VERSION,
        progress: { phase: "queued", pagesDone: 0, pagesTotal: 0 },
        // Copie figée : modifier le projet ensuite ne change pas cet audit.
        inputSnapshot: { siteUrl: project.siteUrl, ...context, competitors: project.competitors },
      },
    });
    return { ok: true as const, auditId: audit.id };
  });
}

export async function listAudits(userId: string, projectId: string) {
  return prisma.audit.findMany({
    where: { projectId, ...OWN_AUDIT, project: { userId } },
    orderBy: { queuedAt: "desc" },
    select: {
      id: true,
      status: true,
      scoreTotal: true,
      queuedAt: true,
      finishedAt: true,
      isDemo: true,
      progress: true,
      scoringVersion: true,
      scoreClarifier: true,
      scoreIndexer: true,
      scoreTunnel: true,
      scoreEnclencher: true,
    },
  });
}

/** Rapport d'un audit, uniquement pour le propriétaire du projet. */
export async function getAuditReport(userId: string, auditId: string) {
  const audit = await prisma.audit.findFirst({
    where: { id: auditId, ...OWN_AUDIT, project: { userId } },
    include: { project: { select: { id: true, companyName: true, siteUrl: true, isDemo: true } } },
  });
  if (!audit) return null;
  const snapshot = audit.reportSnapshot as ScoringResult | null;
  const report = snapshot && typeof snapshot === "object" && snapshot.scoringVersion?.startsWith("cite-") ? snapshot : null;
  // Durée d'attente calculée ici (et non pendant le rendu) pour l'affichage de la progression.
  return { audit, project: audit.project, report, queuedForMs: Date.now() - audit.queuedAt.getTime() };
}

/**
 * Derniers audits notés de l'utilisateur, du plus ancien au plus récent, pour le graphique du tableau de bord.
 * Projets réels seulement s'il en existe ; sinon la démonstration. Jamais les deux mélangés.
 */
export async function getScoreHistory(userId: string, limit = 12) {
  const select = {
    id: true,
    scoreTotal: true,
    finishedAt: true,
    isDemo: true,
    project: { select: { companyName: true } },
  } as const;
  const where = (isDemo: boolean) => ({
    isDemo,
    ...OWN_AUDIT,
    scoreTotal: { not: null },
    finishedAt: { not: null },
    project: { userId },
  });
  let audits = await prisma.audit.findMany({ where: where(false), orderBy: { finishedAt: "desc" }, take: limit, select });
  if (audits.length === 0) {
    audits = await prisma.audit.findMany({ where: where(true), orderBy: { finishedAt: "desc" }, take: limit, select });
  }
  return audits.reverse().flatMap((audit) =>
    audit.scoreTotal !== null && audit.finishedAt
      ? [{ id: audit.id, score: audit.scoreTotal, finishedAt: audit.finishedAt, isDemo: audit.isDemo, companyName: audit.project.companyName }]
      : [],
  );
}
