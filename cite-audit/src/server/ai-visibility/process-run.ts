import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getAiEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { analyzeResponse, type EntityRef } from "@/server/ai-visibility/analyze";
import { getProvider } from "@/server/ai-visibility/providers";
import { reportAiProgress } from "@/server/ai-visibility/queue";
import { createIntervalLimiter, realClock, retryDelayMs, type Clock } from "@/server/ai-visibility/rate-limit";
import { AiProviderError, type AiProvider, type AiProviderId } from "@/server/ai-visibility/types";

/** Essais par requête (le 1er compris) en cas d'erreur temporaire : 429, 5xx, délai, réseau. */
export const MAX_QUERY_ATTEMPTS = 3;

export type RunDeps = {
  provider?: AiProvider;
  clock?: Clock;
  minIntervalMs?: number;
};

type Snapshot = { brand: EntityRef; competitors: EntityRef[] };

const json = (v: unknown) => v as Prisma.InputJsonValue;

function readSnapshot(value: unknown): Snapshot | null {
  const v = value as Partial<Snapshot> | null;
  if (!v?.brand || typeof v.brand.name !== "string") return null;
  return { brand: v.brand, competitors: Array.isArray(v.competitors) ? v.competitors : [] };
}

/**
 * Traite un lancement pris en charge (RUNNING). Reprise : seules les requêtes encore en attente sont envoyées,
 * celles déjà répondues ne sont jamais renvoyées (ni refacturées).
 */
export async function processAiRun(runId: string, deps: RunDeps = {}): Promise<void> {
  const run = await prisma.aiVisibilityRun.findUnique({ where: { id: runId } });
  if (!run || run.isDemo || run.status !== "RUNNING") return;

  const fail = (errorCode: string) =>
    prisma.aiVisibilityRun.update({ where: { id: runId }, data: { status: "FAILED", finishedAt: new Date(), errorCode } });

  const snapshot = readSnapshot(run.inputSnapshot);
  if (!snapshot) return void (await fail("INVALID_INPUT"));
  const provider = deps.provider ?? getProvider(run.provider as AiProviderId);
  if (!provider || !provider.isConfigured()) {
    logger.warn("ai.run_not_configured", { runId, provider: run.provider });
    return void (await fail("NOT_CONFIGURED"));
  }

  const clock = deps.clock ?? realClock;
  const throttle = createIntervalLimiter(deps.minIntervalMs ?? getAiEnv().AI_MIN_INTERVAL_MS, clock);
  const pending = await prisma.aiQueryResult.findMany({ where: { runId, status: "PENDING" }, orderBy: { position: "asc" } });
  let done = run.queryCount - pending.length;
  logger.info("ai.run_started", { runId, provider: run.provider, model: run.model, pending: pending.length });

  try {
    for (const item of pending) {
      let attempt = item.attempts;
      for (;;) {
        attempt += 1;
        await throttle();
        await prisma.aiQueryResult.update({ where: { id: item.id }, data: { attempts: attempt } });
        try {
          const answer = await provider.ask(item.query, { model: run.model });
          const analysis = analyzeResponse(answer.text, answer.sources, snapshot.brand, snapshot.competitors);
          await prisma.aiQueryResult.update({
            where: { id: item.id },
            data: {
              status: "SUCCEEDED",
              askedAt: new Date(clock.now()),
              model: answer.model,
              latencyMs: answer.latencyMs,
              rawResponse: answer.text, // tel que reçu
              rawPayload: json(answer.rawPayload), // tel que reçu
              sources: json(analysis.sources),
              brandDetected: analysis.brand.detectedAs,
              brandMentioned: analysis.brand.mentioned,
              brandCited: analysis.brand.cited,
              brandRecommended: analysis.brand.recommended,
              approxPosition: analysis.brand.approxPosition,
              positionRatio: analysis.brand.positionRatio,
              brandExcerpt: analysis.brand.excerpt,
              competitorsMentioned: json(analysis.competitors),
              confidence: analysis.confidence,
              usage: answer.usage ? json(answer.usage) : Prisma.DbNull,
              costUsd: answer.costUsd,
              errorCode: null,
              errorMessage: null,
              httpStatus: null,
            },
          });
          logger.info("ai.query_succeeded", { runId, position: item.position, model: answer.model, latencyMs: answer.latencyMs, costUsd: answer.costUsd });
          break;
        } catch (error) {
          const e =
            error instanceof AiProviderError ? error : new AiProviderError("NETWORK", "Erreur inattendue lors de l'appel au fournisseur.", true);
          const retry = e.retryable && attempt < MAX_QUERY_ATTEMPTS;
          logger.warn(e.code === "RATE_LIMITED" ? "ai.rate_limited" : "ai.query_failed", {
            runId,
            position: item.position,
            code: e.code,
            httpStatus: e.httpStatus,
            attempt,
            willRetry: retry,
          });
          if (e.code === "AUTH" || e.code === "NOT_CONFIGURED") {
            // Clé refusée : inutile d'envoyer les autres requêtes.
            await prisma.aiQueryResult.updateMany({
              where: { runId, status: "PENDING" },
              data: { status: "FAILED", errorCode: e.code, errorMessage: e.message, httpStatus: e.httpStatus ?? null },
            });
            throw e;
          }
          if (retry) {
            const wait = retryDelayMs(attempt, e.retryAfterMs);
            await reportAiProgress(runId, { done, total: run.queryCount, waitingMs: wait });
            await clock.sleep(wait);
            continue;
          }
          await prisma.aiQueryResult.update({
            where: { id: item.id },
            data: { status: "FAILED", askedAt: new Date(clock.now()), errorCode: e.code, errorMessage: e.message, httpStatus: e.httpStatus ?? null },
          });
          break;
        }
      }
      done += 1;
      await reportAiProgress(runId, { done, total: run.queryCount });
    }
  } catch (error) {
    if (!(error instanceof AiProviderError)) logger.error("ai.run_crashed", { runId, error });
  }

  const results = await prisma.aiQueryResult.findMany({ where: { runId }, select: { status: true, costUsd: true } });
  const ok = results.filter((r) => r.status === "SUCCEEDED").length;
  const costs = results.map((r) => r.costUsd).filter((c): c is number => c !== null);
  await prisma.aiVisibilityRun.update({
    where: { id: runId },
    data: {
      status: ok === results.length ? "SUCCEEDED" : ok > 0 ? "PARTIAL" : "FAILED",
      errorCode: ok === 0 ? (results.length ? "ALL_QUERIES_FAILED" : "NO_QUERIES") : null,
      finishedAt: new Date(),
      actualCostUsd: costs.length ? Math.round(costs.reduce((a, b) => a + b, 0) * 10_000) / 10_000 : null,
      progress: { done: results.length, total: results.length },
    },
  });
  logger.info("ai.run_finished", { runId, succeeded: ok, total: results.length });
}
