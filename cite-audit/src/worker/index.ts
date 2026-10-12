/**
 * Worker CITE Audit : processus séparé de l'application web.
 * Lancement : `pnpm worker` (dans un second terminal, à côté de `pnpm dev`).
 */
import "dotenv/config";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { processAiRun } from "@/server/ai-visibility/process-run";
import { claimNextAiRun } from "@/server/ai-visibility/queue";
import { processAudit } from "@/server/jobs/process-audit";
import { claimNextAudit } from "@/server/jobs/queue";

const POLL_MS = 2_000;
let stopping = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  logger.info("worker.started", { pid: process.pid });
  while (!stopping) {
    let auditId: string | null = null;
    let aiRunId: string | null = null;
    try {
      // Les audits de site passent en priorité ; puis les mesures de visibilité IA.
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
  await prisma.$disconnect();
  logger.info("worker.stopped", {});
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    // On termine l'audit en cours avant de s'arrêter.
    logger.info("worker.stopping", { signal });
    stopping = true;
  });
}

main().catch((error) => {
  logger.error("worker.crashed", { error });
  process.exit(1);
});
