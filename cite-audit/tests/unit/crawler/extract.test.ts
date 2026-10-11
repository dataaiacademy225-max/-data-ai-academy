import { describe, expect, it } from "vitest";
import { extractPageFacts } from "@/server/crawler/extract";
import { VALID_HTML } from "../../helpers/test-site";

const facts = extractPageFacts(VALID_HTML, "https://site-test.com/page-valide");

describe("extractPageFacts — page valide", () => {
  it("extrait title, meta description, langue, robots et canonical", () => {
    expect(facts.title).toBe("Cabinet Test — Conseil data pour PME à Abidjan");
    expect(facts.metaDescription).toMatch(/^Nous aidons les dirigeants de PME/);
    expect(facts.lang).toBe("fr");
    expect(facts.robotsMeta).toEqual({ raw: ["index, follow"], noindex: false, nofollow: false });
    expect(facts.canonical).toEqual(["https://site-test.com/page-valide"]);
  });

  it("extrait H1 et H2 dans l'ordre", () => {
    expect(facts.h1).toEqual(["Conseil data pour les PME d'Abidjan"]);
    expect(facts.h2).toEqual(["Nos résultats", "Ils nous font confiance", "Témoignages", "Études de cas"]);
  });

  it("ne garde que le texte visible", () => {
    expect(facts.visibleText.excerpt).toContain("Conseil data pour les PME d'Abidjan");
    expect(facts.visibleText.excerpt).not.toContain("ne doit pas apparaitre");
    expect(facts.visibleText.excerpt).not.toContain("Texte caché");
    expect(facts.visibleText.excerpt).not.toContain("Autre texte masqué");
    expect(facts.visibleText.wordCount).toBeGreaterThan(80);
    expect(facts.likelyClientRendered).toBe(false);
  });

  it("sépare liens internes (www. compris) et externes, sans doublon ni javascript:", () => {
    const internal = facts.internalLinks.map((l) => l.url);
    expect(internal).toContain("https://site-test.com/offres");
    expect(internal).toContain("https://www.site-test.com/a-propos");
    expect(internal.filter((u) => u === "https://site-test.com/offres")).toHaveLength(1); // #tarifs fusionné
    expect(internal.some((u) => u.startsWith("javascript"))).toBe(false);
    const insee = facts.externalLinks.find((l) => l.url.includes("insee.fr"));
    expect(insee).toMatchObject({ text: "INSEE", nofollow: true });
    expect(facts.externalLinks.map((l) => new URL(l.url).hostname)).toContain("www.linkedin.com");
  });

  it("relève e-mails et téléphones des liens mailto: et tel:", () => {
    expect(facts.contactLinks).toEqual({ emails: ["contact@site-test.com"], phones: ["+2250700000000"] });
  });

  it("lit le JSON-LD valide et signale le bloc invalide sans planter", () => {
    expect(facts.jsonLd).toHaveLength(2);
    const [valid, invalid] = facts.jsonLd;
    expect(valid.valid && valid.types).toEqual(expect.arrayContaining(["ProfessionalService", "AggregateRating", "Person"]));
    expect(invalid).toMatchObject({ valid: false, error: "JSON invalide" });
  });

  it("lit les balises Open Graph", () => {
    expect(facts.openGraph).toEqual({
      "og:title": "Cabinet Test",
      "og:description": "Conseil data pour PME",
      "og:image": "https://site-test.com/og.png",
    });
  });

  it("repère les CTA avec leur position approximative", () => {
    const byText = Object.fromEntries(facts.ctas.map((c) => [c.text, c]));
    expect(byText["Prendre rendez-vous"]).toMatchObject({ element: "link", position: "top" });
    expect(byText["Demander un devis"]).toMatchObject({ element: "input", position: "rest" });
    expect(byText["Écrivez-nous sur WhatsApp"]).toMatchObject({ href: "https://wa.me/2250700000000" });
    // Le bouton de menu et les liens de navigation ne sont pas des CTA.
    expect(facts.ctas.map((c) => c.text)).not.toContain("Offres");
    expect(facts.ctas.find((c) => c.element === "button")).toBeUndefined();
  });

  it("repère les éléments de preuve avec l'extrait exact", () => {
    const types = new Set(facts.proofs.map((p) => p.type));
    expect(types).toEqual(new Set(["testimonial", "client_logos", "case_study", "result_figure", "certification", "rating"]));
    expect(facts.proofs.find((p) => p.type === "result_figure")?.excerpt).toContain("+45 % de leads");
    expect(facts.proofs.find((p) => p.type === "certification")?.excerpt).toContain("Qualiopi");
    expect(facts.proofs.find((p) => p.type === "client_logos")?.excerpt).toContain("Banque A");
    expect(facts.proofs.some((p) => p.type === "rating" && p.source === "json-ld")).toBe(true);
    for (const proof of facts.proofs) expect(proof.excerpt.length).toBeLessThanOrEqual(200);
  });

  it("compte les images sans texte alternatif", () => {
    expect(facts.images).toEqual({ total: 3, missingAlt: 1 });
  });
});

describe("extractPageFacts — cas limites", () => {
  it("renvoie des valeurs vides, jamais inventées, pour une page minimale", () => {
    const empty = extractPageFacts("<html><body></body></html>", "https://site.com/");
    expect(empty).toMatchObject({
      title: null,
      metaDescription: null,
      lang: null,
      canonical: [],
      h1: [],
      h2: [],
      jsonLd: [],
      openGraph: {},
      ctas: [],
      proofs: [],
      robotsMeta: { raw: [], noindex: false, nofollow: false },
    });
  });

  it("détecte noindex/nofollow (directive none comprise)", () => {
    const html = '<head><meta name="ROBOTS" content="none"></head>';
    expect(extractPageFacts(html, "https://site.com/").robotsMeta).toMatchObject({ noindex: true, nofollow: true });
  });

  it("signale une page rendue côté client (peu de texte + application JS)", () => {
    const html = '<html><body><div id="root"></div><script src="/app.js"></script></body></html>';
    expect(extractPageFacts(html, "https://site.com/").likelyClientRendered).toBe(true);
  });

  it("respecte la balise <base> pour résoudre les liens relatifs", () => {
    const html = '<head><base href="https://site.com/fr/"></head><body><a href="offres">Offres</a></body>';
    expect(extractPageFacts(html, "https://site.com/").internalLinks[0].url).toBe("https://site.com/fr/offres");
  });

  it("traite le HTML comme une donnée : aucun script exécuté, balises conservées en texte", () => {
    const html = '<title>&lt;script&gt;alert(1)&lt;/script&gt;</title><body><img src=x onerror="globalThis.pwned=1"></body>';
    const result = extractPageFacts(html, "https://site.com/");
    expect(result.title).toBe("<script>alert(1)</script>");
    expect((globalThis as { pwned?: number }).pwned).toBeUndefined();
  });
});
