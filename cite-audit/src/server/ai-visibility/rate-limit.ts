/**
 * Espacement des appels et attente avant nouvel essai. Horloge et attente injectables pour les tests.
 */

export type Clock = { now: () => number; sleep: (ms: number) => Promise<void> };
export const realClock: Clock = { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

/** Garantit un délai minimal entre deux appels successifs au même fournisseur. */
export function createIntervalLimiter(minIntervalMs: number, clock: Clock = realClock) {
  let last = -Infinity;
  return async () => {
    const wait = last + minIntervalMs - clock.now();
    if (wait > 0) await clock.sleep(wait);
    last = clock.now();
  };
}

/** Attente avant nouvel essai : délai demandé par le fournisseur, sinon 2 s, 4 s, 8 s… (plafond 60 s). */
export function retryDelayMs(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined) return Math.min(Math.max(retryAfterMs, 500), 60_000);
  return Math.min(2000 * 2 ** (attempt - 1), 60_000);
}
