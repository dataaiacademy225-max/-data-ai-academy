/**
 * Appelé une fois au démarrage du serveur Next.js.
 * Mode hébergement gratuit (RUN_WORKER_IN_WEB=true) : la boucle du worker tourne dans le même processus
 * que l'application, pour n'avoir qu'un seul service à héberger. Par défaut, le worker reste séparé (`pnpm worker`).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.RUN_WORKER_IN_WEB !== "true") return;
  const { startWorkerInWeb } = await import("@/worker/in-web");
  startWorkerInWeb();
}
