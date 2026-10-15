import { describe, expect, it } from "vitest";
import { LANDING } from "@/content/landing";
import { findForbiddenWording } from "@/server/scoring/wording-guard";

const collect = (value: unknown): string[] =>
  typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(collect) : [];

describe("page d'accueil", () => {
  const texts = collect(LANDING);

  it("aucune promesse de résultat IA ou Google", () => {
    expect(texts.length).toBeGreaterThan(20);
    for (const text of texts) expect(findForbiddenWording(text), text).toEqual([]);
  });

  it("rappelle l'absence de garantie, la nature interne du score et signale l'exemple fictif", () => {
    expect(LANDING.hero.disclaimer).toContain("non garanti");
    expect(LANDING.method.note).toContain("indicateur interne");
    expect(LANDING.preview.badge).toContain("[DÉMO]");
  });
});
