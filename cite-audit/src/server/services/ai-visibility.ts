import "server-only";
import { estimateCost, PRICES_AS_OF, type CostEstimate } from "@/lib/ai-pricing";
import { getAiEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import type { Competitor } from "@/lib/validation/project";
import { describeProviders } from "@/server/ai-visibility/providers";
import { summarizeAiSamples } from "@/server/ai-visibility/summary";
import type { Prisma } from "@/generated/prisma/client";
import { QUEUED_STALE_MS } from "@/server/services/audits";
import { lockForTransaction } from "@/server/services/locks";

type Db = Prisma.TransactionClient;
import type { AiProviderId } from "@/server/ai-visibility/types";

export type AiLaunchError =
  | "MODULE_DISABLED"
  | "UNKNOWN_MODEL"
  | "NOT_FOUND"
  | "DEMO_PROJECT"
  | "NO_QUERIES"
  | "TOO_MANY_QUERIES"
  | "DAILY_LIMIT"
  | "ALREADY_RUNNING"
  | "COST_NOT_ACCEPTED";

/** État du module pour l'interface : aucun secret, seulement « activé ou non » et les limites. */
export function getAiModuleStatus() {
  const env = getAiEnv();
  const providers = describeProviders();
  return {
    enabled: providers.length > 0,
    providers,
    limits: { perRun: env.AI_MAX_QUERIES_PER_RUN, perDay: env.AI_MAX_QUERIES_PER_DAY },
    pricesAsOf: PRICES_AS_OF,
  };
}

/**
 * Requêtes IA envoyées ou programmées par l'utilisateur sur les dernières 24 h.
 * Les requêtes jamais envoyées d'une mesure annulée ne comptent pas.
 */
export async function queriesUsedToday(userId: string, db: Db = prisma): Promise<number> {
  return db.aiQueryResult.count({
    where: {
      run: { project: { userId }, queuedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      OR: [{ status: { not: "PENDING" } }, { run: { status: { not: "CANCELED" } } }],
    },
  });
}

/** Annule les mesures restées en attente trop longtemps (worker absent) pour ne pas bloquer le projet. */
export async function cancelStaleAiRuns(projectId: string, db: Db = prisma): Promise<number> {
  const { count } = await db.aiVisibilityRun.updateMany({
    where: { projectId, status: "QUEUED", queuedAt: { lt: new Date(Date.now() - QUEUED_STALE_MS) } },
    data: { status: "CANCELED", finishedAt: new Date(), errorCode: "QUEUE_TIMEOUT" },
  });
  return count;
}

export async function requestAiRun(
  userId: string,
  projectId: string,
  input: { providerId: string; model: string; queries: string[]; costAccepted: boolean },
): Promise<{ ok: true; runId: string; estimate: CostEstimate } | { ok: false; error: AiLaunchError }> {
  const status = getAiModuleStatus();
  if (!status.enabled) return { ok: false, error: "MODULE_DISABLED" };
  const provider = status.providers.find((p) => p.id === input.providerId);
  if (!provider || !provider.models.some((m) => m.id === input.model)) return { ok: false, error: "UNKNOWN_MODEL" };

  if (input.queries.length === 0) return { ok: false, error: "NO_QUERIES" };
  if (input.queries.length > status.limits.perRun) return { ok: false, error: "TOO_MANY_QUERIES" };

  // Vérifications et création sous verrou par utilisateur : pas de doublon ni de dépassement de quota
  // quand plusieurs demandes arrivent en même temps.
  return prisma.$transaction(async (tx) => {
    await lockForTransaction(tx, `ai-request:${userId}`);

    const project = await tx.project.findFirst({ where: { id: projectId, userId } });
    if (!project) return { ok: false as const, error: "NOT_FOUND" as const };
    if (project.isDemo) return { ok: false as const, error: "DEMO_PROJECT" as const };

    if ((await queriesUsedToday(userId, tx)) + input.queries.length > status.limits.perDay) {
      return { ok: false as const, error: "DAILY_LIMIT" as const };
    }
    await cancelStaleAiRuns(projectId, tx);
    if (await tx.aiVisibilityRun.findFirst({ where: { projectId, status: { in: ["QUEUED", "RUNNING"] } } })) {
      return { ok: false as const, error: "ALREADY_RUNNING" as const };
    }
    // Le coût estimé doit avoir été affiché et accepté avant tout envoi.
    if (!input.costAccepted) return { ok: false as const, error: "COST_NOT_ACCEPTED" as const };

    const estimate = estimateCost(input.model, input.queries);
    const competitors = (project.competitors as Competitor[] | null) ?? [];
    const run = await tx.aiVisibilityRun.create({
      data: {
        projectId,
        provider: input.providerId as AiProviderId,
        model: input.model,
        queryCount: input.queries.length,
        estimatedCostMinUsd: estimate.minUsd,
        estimatedCostMaxUsd: estimate.maxUsd,
        progress: { done: 0, total: input.queries.length },
        inputSnapshot: {
          brand: { name: project.companyName, url: project.siteUrl },
          competitors: competitors.map((c) => ({ name: c.name, url: c.url ?? null })),
        },
        results: {
          create: input.queries.map((query, position) => ({
            position,
            query,
            provider: input.providerId as AiProviderId,
            requestedModel: input.model,
          })),
        },
      },
    });
    return { ok: true as const, runId: run.id, estimate };
  });
}

/** Lancements récents d'un projet et leurs résultats, pour le propriétaire uniquement. */
export async function getAiVisibility(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return null;
  const runs = await prisma.aiVisibilityRun.findMany({
    where: { projectId },
    orderBy: { queuedAt: "desc" },
    take: 10,
    include: { results: { orderBy: { position: "asc" } } },
  });
  return { project, runs, usedToday: await queriesUsedToday(userId) };
}

/** Synthèse des échantillons de réponses d'IA de l'utilisateur (requêtes réussies), pour le tableau de bord. */
export async function getAiSampleSummary(userId: string) {
  const rows = await prisma.aiQueryResult.findMany({
    where: { status: "SUCCEEDED", run: { project: { userId } } },
    select: {
      provider: true,
      brandMentioned: true,
      brandCited: true,
      brandRecommended: true,
      run: { select: { isDemo: true } },
    },
    take: 5000,
  });
  return summarizeAiSamples(
    rows.map((row) => ({
      provider: row.provider,
      isDemo: row.run.isDemo,
      brandMentioned: row.brandMentioned,
      brandCited: row.brandCited,
      brandRecommended: row.brandRecommended,
    })),
  );
}
