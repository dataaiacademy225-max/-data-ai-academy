import "server-only";
import { getRetentionEnv, getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { processAiRun } from "@/server/ai-visibility/process-run";
import { claimNextAiRun } from "@/server/ai-visibility/queue";
import { sendEmail } from "@/server/email/send";
import { processAudit } from "@/server/jobs/process-audit";
import { claimNextAudit } from "@/server/jobs/queue";
import { processInactiveAccounts } from "@/server/services/inactive-accounts";
import { purgeExpiredData } from "@/server/services/retention";

const POLL_MS = 2_000;
const PURGE_EVERY_MS = 24 * 60 * 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Tâches quotidiennes : purge des données expirées, puis comptes inactifs. Chacune isolée. */
async function runDailyTasks(): Promise<void> {
  try {
    const { sessions, ...rest } = await purgeExpiredData(getRetentionEnv());
    // « sessions » serait masqué par le journal (nom sensible) : ce n'est qu'un nombre.
    logger.info("worker.purge_done", { expiredLogins: sessions, ...rest });
  } catch (error) {
    logger.error("worker.purge_failed", { error });
  }
  try {
    const retention = getRetentionEnv();
    const inactive = await processInactiveAccounts(
      { inactiveDays: retention.INACTIVE_ACCOUNT_DAYS, graceDays: retention.INACTIVE_ACCOUNT_GRACE_DAYS },
      { sendEmail, appUrl: getServerEnv().BETTER_AUTH_URL },
    );
    logger.info("worker.inactive_accounts_done", inactive);
  } catch (error) {
    logger.error("worker.inactive_accounts_failed", { error });
  }
}

/**
 * Boucle du worker : audits en priorité, puis mesures de visibilité IA ; tâches quotidiennes au démarrage
 * puis toutes les 24 h. S'arrête proprement (après le travail en cours) quand `shouldStop()` devient vrai.
 * Utilisée par le worker séparé (`pnpm worker`) et, en mode hébergement gratuit, par l'application web.
 */
export async function runWorkerLoop(shouldStop: () => boolean): Promise<void> {
  let lastDailyAt = 0;
  while (!shouldStop()) {
    if (Date.now() - lastDailyAt >= PURGE_EVERY_MS) {
      lastDailyAt = Date.now();
      await runDailyTasks();
    }
    let auditId: string | null = null;
    let aiRunId: string | null = null;
    try {
      auditId = await claimNextAudit();
      if (!auditId) aiRunId = await claimNextAiRun();
    } catch (error) {
      logger.error("worker.claim_failed", { error });
    }
    // Chaque travail est isolé : une erreur imprévue est journalisée sans arrêter le worker.
    try {
      if (auditId) {
        logger.info("worker.audit_started", { auditId });
        await processAudit(auditId);
      } else if (aiRunId) {
        logger.info("worker.ai_run_started", { runId: aiRunId });
        await processAiRun(aiRunId);
      } else {
        await sleep(POLL_MS);
      }
    } catch (error) {
      logger.error("worker.job_failed", { auditId, runId: aiRunId, error });
      await sleep(POLL_MS);
    }
  }
}
