/**
 * Worker CITE Audit : processus séparé de l'application web.
 * Lancement : `pnpm worker` (dans un second terminal, à côté de `pnpm dev`).
 * En hébergement gratuit, la même boucle tourne dans l'application web (RUN_WORKER_IN_WEB, voir src/instrumentation.ts).
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { runWorkerLoop } from "@/worker/loop";

let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    // On termine l'audit en cours avant de s'arrêter.
    logger.info("worker.stopping", { signal });
    stopping = true;
  });
}

async function main() {
  logger.info("worker.started", { pid: process.pid });
  await runWorkerLoop(() => stopping);
  await prisma.$disconnect();
  logger.info("worker.stopped", {});
}

main().catch((error) => {
  logger.error("worker.crashed", { error });
  process.exit(1);
});
