import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { consumeLimit, purgeExpiredLimits, resetLimit, tooManyAttemptsMessage } from "@/server/services/rate-limit";

const rule = { max: 3, windowMs: 60_000 };
const t0 = new Date("2026-10-12T10:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("limite de tentatives", () => {
  it("refuse au-delà du maximum, puis autorise à nouveau après la fenêtre", async () => {
    for (let i = 0; i < 3; i++) expect(await consumeLimit("k", rule, at(i * 1000))).toEqual({ allowed: true });
    expect(await consumeLimit("k", rule, at(10_000))).toEqual({ allowed: false, retryAfterMs: 50_000 });
    expect(await consumeLimit("k", rule, at(60_000))).toEqual({ allowed: true });
  });

  it("sépare les clés et peut être remise à zéro", async () => {
    for (let i = 0; i < 4; i++) await consumeLimit("a", rule, t0);
    expect((await consumeLimit("a", rule, t0)).allowed).toBe(false);
    expect((await consumeLimit("b", rule, t0)).allowed).toBe(true);
    await resetLimit("a");
    expect((await consumeLimit("a", rule, t0)).allowed).toBe(true);
  });

  it("reste exacte sous des tentatives simultanées", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => consumeLimit("parallèle", rule, t0)));
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
  });

  it("ne stocke ni e-mail ni IP en clair", async () => {
    await consumeLimit("sign-in:email:alice@example.com", rule, t0);
    const rows = await prisma.actionLimit.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("purge les compteurs expirés", async () => {
    await consumeLimit("ancien", rule, t0);
    await consumeLimit("récent", rule, at(2 * 86_400_000));
    expect(await purgeExpiredLimits(at(2 * 86_400_000))).toBe(1);
    expect(await prisma.actionLimit.count()).toBe(1);
  });

  it("affiche un délai lisible", () => {
    expect(tooManyAttemptsMessage(50_000)).toBe("Trop de tentatives. Réessayez dans 1 minute.");
    expect(tooManyAttemptsMessage(14 * 60_000 + 1)).toBe("Trop de tentatives. Réessayez dans 15 minutes.");
  });
});
