import { describe, expect, it } from "vitest";
import { formatRetention, hasPlaceholders, LEGAL_ENTITY, legalPages } from "@/content/legal";
import { findForbiddenWording } from "@/server/scoring/wording-guard";

const pages = legalPages({ auditRetentionDays: 730, aiRunRetentionDays: 365 });
const allText = Object.values(pages).flatMap((p) => [
  p.title,
  p.intro,
  ...p.sections.flatMap((s) => [s.title, ...s.paragraphs, ...(s.list ?? [])]),
]);

describe("pages légales", () => {
  it("aucune promesse de résultat IA ou Google", () => {
    for (const text of allText) expect(findForbiddenWording(text), text).toEqual([]);
  });

  it("couvrent l'Afrique francophone et l'Europe (RGPD, représentant UE, autorités)", () => {
    const privacy = JSON.stringify(pages.confidentialite);
    expect(privacy).toContain("RGPD");
    expect(privacy).toContain("Représentant dans l'Union européenne");
    expect(privacy).toContain("ARTCI");
    expect(privacy).toContain("CNIL");
    expect(privacy).toContain("Bases légales");
  });

  it("rappellent l'absence de garantie et la nature interne du score", () => {
    const conditions = JSON.stringify(pages.conditions);
    expect(conditions).toContain("Résultat non garanti");
    expect(conditions).toContain("indicateur interne");
  });

  it("affichent les durées de conservation configurées", () => {
    const privacy = JSON.stringify(pages.confidentialite);
    expect(privacy).toContain("Audits : 2 ans");
    expect(privacy).toContain("réponses reçues : 1 an");
    expect(JSON.stringify(legalPages({ auditRetentionDays: 0, aiRunRetentionDays: 90 }).confidentialite)).toContain("90 jours");
    const unlimited = JSON.stringify(legalPages({ auditRetentionDays: 0, aiRunRetentionDays: 0 }).confidentialite);
    expect(unlimited).toContain("Audits : gardés tant que le projet et le compte existent");
    expect(unlimited).not.toContain("toujours gardé");
  });

  it("décrivent la règle des comptes inactifs (3 ans, puis 30 jours)", () => {
    const privacy = JSON.stringify(pages.confidentialite);
    expect(privacy).toContain("après 3 ans sans connexion, vous recevez un e-mail d'avertissement");
    expect(privacy).toContain("dans les 30 jours qui suivent");
    const off = JSON.stringify(legalPages({ auditRetentionDays: 0, aiRunRetentionDays: 0, inactiveAccountDays: 0 }).confidentialite);
    expect(off).toContain("aucune suppression automatique");
  });

  it("formate les durées", () => {
    expect(formatRetention(730)).toBe("2 ans");
    expect(formatRetention(365)).toBe("1 an");
    expect(formatRetention(45)).toBe("45 jours");
    expect(formatRetention(0)).toMatch(/sans limite/);
  });

  it("signalent le brouillon tant qu'un champ reste à compléter", () => {
    expect(hasPlaceholders(LEGAL_ENTITY)).toBe(true);
    expect(hasPlaceholders({ companyName: "Data & AI Academy SARL" })).toBe(false);
  });
});
