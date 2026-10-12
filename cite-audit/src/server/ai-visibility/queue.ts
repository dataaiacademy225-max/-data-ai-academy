import { prisma } from "@/lib/db";
import { LOCK_TIMEOUT_MS, MAX_ATTEMPTS } from "@/server/jobs/queue";

/**
 * File d'attente des lancements de mesure IA (même principe que les audits :
 * prise en charge exclusive, reprise d'un lancement abandonné, échec après MAX_ATTEMPTS).
 */

export async function claimNextAiRun(lockTimeoutMs = LOCK_TIMEOUT_MS): Promise<string | null> {
  await prisma.$executeRaw`
    UPDATE "AiVisibilityRun"
    SET status = 'FAILED', "errorCode" = 'TOO_MANY_ATTEMPTS', "finishedAt" = now()
    WHERE status = 'RUNNING' AND attempts >= ${MAX_ATTEMPTS}
      AND "lockedAt" < now() - make_interval(secs => ${lockTimeoutMs / 1000})`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "AiVisibilityRun"
    SET status = 'RUNNING', "lockedAt" = now(), "startedAt" = COALESCE("startedAt", now()), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "AiVisibilityRun"
      WHERE "isDemo" = false
        AND (
          status = 'QUEUED'
          OR (status = 'RUNNING' AND attempts < ${MAX_ATTEMPTS} AND "lockedAt" < now() - make_interval(secs => ${lockTimeoutMs / 1000}))
        )
      ORDER BY "queuedAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id`;
  return rows[0]?.id ?? null;
}

export async function reportAiProgress(runId: string, progress: { done: number; total: number; waitingMs?: number }) {
  await prisma.aiVisibilityRun.updateMany({ where: { id: runId, status: "RUNNING" }, data: { progress, lockedAt: new Date() } });
}
