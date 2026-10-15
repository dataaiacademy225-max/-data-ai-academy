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
    expect(LANDING.hero.transparency).toContain("n'est garantie");
    const { titleStart, titleHighlight, titleEnd } = LANDING.hero;
    expect(`${titleStart} ${titleHighlight} ${titleEnd}`).toBe("Découvrez pourquoi votre marque est peu visible dans Google et les IA");
    expect(LANDING.method.note).toContain("indicateur interne");
    expect(LANDING.preview.badge).toContain("[DÉMO]");
  });

  it("section de preuve : audit interne daté, score interne, aucune généralisation", () => {
    const { proof } = LANDING;
    expect(proof.badge).toBe("Audit interne");
    expect(proof.auditDate).toMatch(/\d{4}/);
    expect(proof.scoreNote).toContain("pas une note de Google ni de ChatGPT");
    expect(proof.transparency).toContain("ne constitue pas une garantie");
    // La somme des piliers du rapport réel redonne le score affiché.
    expect(Math.round(proof.pillars.reduce((n, p) => n + p.value, 0))).toBe(proof.score);
    const all = JSON.stringify(proof).toLowerCase();
    for (const forbidden of ["toutes les ia", "numéro 1", "garanti par", "score officiel"]) expect(all).not.toContain(forbidden);
  });
});
