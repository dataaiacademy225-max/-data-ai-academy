import "server-only";
import { estimateCost, PRICES_AS_OF, type CostEstimate } from "@/lib/ai-pricing";
import { getAiEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import type { Competitor } from "@/lib/validation/project";
import { describeProviders } from "@/server/ai-visibility/providers";
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

/** Requêtes IA envoyées ou programmées par l'utilisateur sur les dernières 24 h. */
export async function queriesUsedToday(userId: string): Promise<number> {
  return prisma.aiQueryResult.count({
    where: { run: { project: { userId }, queuedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
  });
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

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return { ok: false, error: "NOT_FOUND" };
  if (project.isDemo) return { ok: false, error: "DEMO_PROJECT" };

  if (input.queries.length === 0) return { ok: false, error: "NO_QUERIES" };
  if (input.queries.length > status.limits.perRun) return { ok: false, error: "TOO_MANY_QUERIES" };
  if ((await queriesUsedToday(userId)) + input.queries.length > status.limits.perDay) return { ok: false, error: "DAILY_LIMIT" };
  if (await prisma.aiVisibilityRun.findFirst({ where: { projectId, status: { in: ["QUEUED", "RUNNING"] } } })) {
    return { ok: false, error: "ALREADY_RUNNING" };
  }
  // Le coût estimé doit avoir été affiché et accepté avant tout envoi.
  if (!input.costAccepted) return { ok: false, error: "COST_NOT_ACCEPTED" };

  const estimate = estimateCost(input.model, input.queries);
  const competitors = (project.competitors as Competitor[] | null) ?? [];
  const run = await prisma.aiVisibilityRun.create({
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
  return { ok: true, runId: run.id, estimate };
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
