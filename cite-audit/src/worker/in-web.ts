import "server-only";
import { logger } from "@/lib/logger";
import { runWorkerLoop } from "@/worker/loop";

const globalForWorker = globalThis as unknown as { citeWorkerStarted?: boolean };

/**
 * Lance la boucle du worker en arrière-plan dans le serveur web (sans bloquer son démarrage).
 * Garde-fou : une seule boucle par processus, même si Next.js recharge ce module en développement.
 * À l'arrêt du serveur, un audit interrompu est repris automatiquement plus tard (verrou expiré, 3 tentatives).
 */
export function startWorkerInWeb(): void {
  if (globalForWorker.citeWorkerStarted) return;
  globalForWorker.citeWorkerStarted = true;
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => (stopping = true));
  logger.info("worker.started_in_web", { pid: process.pid });
  void runWorkerLoop(() => stopping).catch((error) => logger.error("worker.crashed", { error }));
}
