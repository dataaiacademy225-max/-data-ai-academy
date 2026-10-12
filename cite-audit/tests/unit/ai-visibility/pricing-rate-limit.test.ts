import { describe, expect, it } from "vitest";
import { estimateCost } from "@/lib/ai-pricing";
import { createIntervalLimiter, retryDelayMs, type Clock } from "@/server/ai-visibility/rate-limit";

describe("estimateCost", () => {
  it("donne une fourchette croissante avec le nombre de requêtes", () => {
    const one = estimateCost("perplexity/sonar", ["Quel cabinet data choisir à Abidjan ?"]);
    const ten = estimateCost("perplexity/sonar", Array(10).fill("Quel cabinet data choisir à Abidjan ?"));
    expect(one.known).toBe(true);
    expect(one.minUsd).toBeGreaterThan(0);
    expect(one.maxUsd).toBeGreaterThan(one.minUsd);
    expect(ten.minUsd).toBeGreaterThanOrEqual(one.minUsd * 5);
    expect(ten.maxUsd).toBeLessThan(1); // ordre de grandeur : quelques centimes par requête
  });

  it("signale un modèle sans tarif connu au lieu d'inventer un prix", () => {
    expect(estimateCost("modele-inconnu", ["Q"])).toEqual({ queries: 1, minUsd: 0, maxUsd: 0, known: false });
  });
});

describe("limitation du débit", () => {
  function fakeClock(): Clock & { slept: number[] } {
    let t = 0;
    const slept: number[] = [];
    return { now: () => t, sleep: async (ms) => void (slept.push(ms), (t += ms)), slept };
  }

  it("espace les appels d'au moins l'intervalle minimal", async () => {
    const clock = fakeClock();
    const throttle = createIntervalLimiter(1500, clock);
    await throttle();
    await throttle();
    await throttle();
    expect(clock.slept).toEqual([1500, 1500]);
  });

  it("attente avant nouvel essai : Retry-After d'abord, sinon progression exponentielle plafonnée", () => {
    expect(retryDelayMs(1, 7000)).toBe(7000);
    expect(retryDelayMs(1, 0)).toBe(500);
    expect([1, 2, 3].map((a) => retryDelayMs(a))).toEqual([2000, 4000, 8000]);
    expect(retryDelayMs(10)).toBe(60_000);
  });
});
