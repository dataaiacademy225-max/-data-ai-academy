import "server-only";
import { prisma } from "@/lib/db";
import type { Competitor } from "@/lib/validation/project";
import { buildComparison, readReport, type SiteInput, type SiteState } from "@/server/report/comparison";
import { SCORING_VERSION, type ScoringContext } from "@/server/scoring";
import { MAX_AUDITS_PER_DAY, OWN_AUDIT, QUEUED_STALE_MS } from "@/server/services/audits";
import { lockForTransaction } from "@/server/services/locks";

/** Nombre de concurrents audités par comparaison (chacun compte dans la limite d'audits par jour). */
export const MAX_COMPETITORS_PER_COMPARISON = 3;

export type ComparisonLaunchError = "NOT_FOUND" | "DEMO_PROJECT" | "NO_COMPETITOR_URL" | "QUOTA" | "ALREADY_RUNNING";

/** Concurrents enregistrés dans le projet (JSON relu de façon défensive), avec une adresse de site. */
export function competitorsWithSite(value: unknown): Required<Competitor>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((c: unknown) => {
    const item = c as Partial<Competitor> | null;
    return item && typeof item.name === "string" && typeof item.url === "string" && /^https?:\/\//.test(item.url)
      ? [{ name: item.name, url: item.url }]
      : [];
  });
}

/**
 * Lance l'audit des concurrents du projet (les 3 premiers dont l'adresse du site est connue).
 * Mêmes protections que pour un audit : droits vérifiés, limite par jour, une seule comparaison en cours.
 * Les concurrents sont notés avec les informations de marché du projet : seuls le nom et le site changent.
 */
export async function requestComparison(
  userId: string,
  projectId: string,
  options: { dailyLimit?: number | null } = {},
): Promise<{ ok: true; comparisonId: string } | { ok: false; error: ComparisonLaunchError }> {
  return prisma.$transaction(async (tx) => {
    // Même verrou que les audits : la limite par jour est partagée.
    await lockForTransaction(tx, `audit-request:${userId}`);

    const project = await tx.project.findFirst({ where: { id: projectId, userId } });
    if (!project) return { ok: false as const, error: "NOT_FOUND" as const };
    if (project.isDemo) return { ok: false as const, error: "DEMO_PROJECT" as const };

    const competitors = competitorsWithSite(project.competitors)
      .filter((c) => c.url !== project.siteUrl)
      .slice(0, MAX_COMPETITORS_PER_COMPARISON);
    if (competitors.length === 0) return { ok: false as const, error: "NO_COMPETITOR_URL" as const };

    const dailyLimit = options.dailyLimit === undefined ? MAX_AUDITS_PER_DAY : options.dailyLimit;
    if (dailyLimit !== null) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = await tx.audit.count({ where: { project: { userId }, queuedAt: { gte: since } } });
      if (recent + competitors.length > dailyLimit) return { ok: false as const, error: "QUOTA" as const };
    }

    await tx.audit.updateMany({
      where: {
        projectId,
        comparisonId: { not: null },
        status: "QUEUED",
        queuedAt: { lt: new Date(Date.now() - QUEUED_STALE_MS) },
      },
      data: { status: "CANCELED", finishedAt: new Date(), errorCode: "QUEUE_TIMEOUT" },
    });
    const pending = await tx.audit.findFirst({
      where: { projectId, comparisonId: { not: null }, status: { in: ["QUEUED", "RUNNING"] } },
    });
    if (pending) return { ok: false as const, error: "ALREADY_RUNNING" as const };

    const context: ScoringContext = {
      companyName: project.companyName,
      sector: project.sector,
      primaryTarget: project.primaryTarget,
      city: project.city,
      country: project.country,
      geoQueries: project.geoQueries,
    };
    const comparison = await tx.comparison.create({ data: { projectId } });
    for (const competitor of competitors) {
      await tx.audit.create({
        data: {
          projectId,
          comparisonId: comparison.id,
          competitorName: competitor.name,
          competitorUrl: competitor.url,
          status: "QUEUED",
          scoringVersion: SCORING_VERSION,
          progress: { phase: "queued", pagesDone: 0, pagesTotal: 0 },
          inputSnapshot: { ...context, siteUrl: competitor.url, companyName: competitor.name, competitorOf: project.companyName },
        },
      });
    }
    return { ok: true as const, comparisonId: comparison.id };
  });
}

const TERMINAL = ["SUCCEEDED", "PARTIAL", "FAILED", "CANCELED"] as const;

function stateOf(status: string): SiteState {
  if (status === "SUCCEEDED" || status === "PARTIAL") return "DONE";
  if (status === "QUEUED" || status === "RUNNING") return "PENDING";
  return "FAILED";
}

/**
 * Dernière comparaison d'un projet, prête à afficher. Réservé au propriétaire du projet (filtre userId) :
 * une comparaison d'autrui renvoie null, comme un projet introuvable.
 */
export async function getComparison(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true, companyName: true, siteUrl: true, isDemo: true, competitors: true },
  });
  if (!project) return null;

  const [comparison, ownAudit] = await Promise.all([
    prisma.comparison.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        audits: {
          orderBy: { queuedAt: "asc" },
          select: { id: true, status: true, competitorName: true, competitorUrl: true, finishedAt: true, reportSnapshot: true, progress: true },
        },
      },
    }),
    prisma.audit.findFirst({
      where: { projectId, ...OWN_AUDIT, status: { in: ["SUCCEEDED", "PARTIAL"] } },
      orderBy: { finishedAt: "desc" },
      select: { id: true, finishedAt: true, reportSnapshot: true },
    }),
  ]);

  const sites: SiteInput[] = [
    {
      name: project.companyName,
      url: project.siteUrl,
      isYou: true,
      state: ownAudit ? "DONE" : "FAILED",
      report: ownAudit ? readReport(ownAudit.reportSnapshot) : null,
      auditedAt: ownAudit?.finishedAt ?? null,
    },
    ...(comparison?.audits ?? []).map((a) => ({
      name: a.competitorName ?? "Concurrent",
      url: a.competitorUrl ?? "",
      isYou: false,
      state: stateOf(a.status),
      report: readReport(a.reportSnapshot),
      auditedAt: a.finishedAt,
    })),
  ];

  return {
    project,
    comparison: comparison ? { id: comparison.id, createdAt: comparison.createdAt } : null,
    ownAuditId: ownAudit?.id ?? null,
    pending: (comparison?.audits ?? []).some((a) => !(TERMINAL as readonly string[]).includes(a.status)),
    competitorsWithSite: competitorsWithSite(project.competitors).length,
    view: buildComparison(sites),
  };
}

/**
 * Appelé par le worker après chaque audit de concurrent : quand tous les audits de la comparaison sont
 * terminés, la marque comme notifiée (une seule fois, même si deux workers terminent en même temps)
 * et renvoie de quoi prévenir l'utilisateur. Sinon null.
 */
export async function claimComparisonNotification(comparisonId: string, now = new Date()) {
  const remaining = await prisma.audit.count({ where: { comparisonId, status: { in: ["QUEUED", "RUNNING"] } } });
  if (remaining > 0) return null;
  const { count } = await prisma.comparison.updateMany({ where: { id: comparisonId, notifiedAt: null, isDemo: false }, data: { notifiedAt: now } });
  if (count === 0) return null;
  return prisma.comparison.findUnique({
    where: { id: comparisonId },
    select: {
      projectId: true,
      project: { select: { companyName: true, user: { select: { name: true, email: true } } } },
      audits: { select: { status: true } },
    },
  });
}
