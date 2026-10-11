/**
 * Worker CITE Audit : processus séparé de l'application web.
 * Lancement : `pnpm worker` (dans un second terminal, à côté de `pnpm dev`).
 */
import "dotenv/config";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { processAudit } from "@/server/jobs/process-audit";
import { claimNextAudit } from "@/server/jobs/queue";

const POLL_MS = 2_000;
let stopping = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  logger.info("worker.started", { pid: process.pid });
  while (!stopping) {
    let auditId: string | null = null;
    try {
      auditId = await claimNextAudit();
    } catch (error) {
      logger.error("worker.claim_failed", { error });
    }
    if (!auditId) {
      await sleep(POLL_MS);
      continue;
    }
    logger.info("worker.audit_started", { auditId });
    await processAudit(auditId);
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
