import { describe, expect, it } from "vitest";
import { CRITERIA, PILLARS, PRIORITY_RANK, findForbiddenWording, scoreSite, type ScoringResult } from "@/server/scoring";
import { failedInput, fixture, siteInput, SITE_URL } from "../../helpers/scoring-fixtures";

const criterion = (r: ScoringResult, code: string) =>
  Object.values(r.pillars).flatMap((p) => p.criteria).find((c) => c.code === code)!;

/** Propriétés qui doivent tenir pour TOUT résultat : explicabilité, cohérence des points, ton. */
function expectExplainable(result: ScoringResult) {
  for (const pillar of Object.values(result.pillars)) {
    expect(pillar.criteria.reduce((n, c) => n + c.maxPoints, 0)).toBe(pillar.maxPoints);
    for (const c of pillar.criteria) {
      expect(c.explanation.length, `${c.code} sans explication`).toBeGreaterThan(10);
      // Accords au pluriel écrits en toutes lettres (« 12 titres de page »), jamais « titre(s) ».
      for (const text of [c.explanation, ...(c.missing ?? [])]) expect(text, c.code).not.toMatch(/\p{L}\(s\)/u);
      if (c.status === "NOT_VERIFIED" || c.status === "NOT_APPLICABLE") {
        expect(c.points, `${c.code} non vérifié ne doit pas avoir de points`).toBeNull();
      } else {
        expect(c.points).toBeGreaterThanOrEqual(0);
        expect(c.points).toBeLessThanOrEqual(c.maxPoints);
        if (c.status === "PASS") expect(c.points).toBe(c.maxPoints);
        if (c.status === "FAIL") expect(c.points).toBe(0);
        if (c.status !== "PASS") expect(c.priority).not.toBeNull();
      }
    }
    // Le score du pilier se recalcule à partir des points des critères mesurés.
    const measured = pillar.criteria.filter((c) => c.points !== null);
    if (pillar.score !== null) {
      const max = measured.reduce((n, c) => n + c.maxPoints, 0);
      const got = measured.reduce((n, c) => n + (c.points ?? 0), 0);
      expect(pillar.score).toBe(Math.round(((pillar.maxPoints * got) / max) * 2) / 2);
    }
  }
  if (result.scoreTotal !== null) {
    const sum = Object.values(result.pillars).reduce((n, p) => n + (p.score ?? 0), 0);
    expect(result.scoreTotal).toBe(Math.round(sum));
  }
  // Recommandations triées par priorité.
  const ranks = result.recommendations.map((r) => PRIORITY_RANK[r.priority]);
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  // Aucune promesse de résultat dans tout le texte produit.
  expect(findForbiddenWording(JSON.stringify(result))).toEqual([]);
}

describe("site clair et complet", () => {
  const result = scoreSite(siteInput(fixture("complete")));

  it("obtient un score élevé dans chaque pilier", () => {
    expectExplainable(result);
    expect(result.status).toBe("SCORED");
    expect(result.scoreTotal).toBeGreaterThanOrEqual(85);
    expect(result.pillars.CLARIFIER.score).toBeGreaterThanOrEqual(22);
    expect(result.pillars.ENCLENCHER.score).toBe(20);
  });

  it("liste des forces et peu de recommandations, aucune critique", () => {
    expect(result.strengths.length).toBeGreaterThanOrEqual(20);
    expect(result.recommendations.filter((r) => r.priority === "CRITIQUE")).toEqual([]);
  });

  it("signale honnêtement ce qui n'est pas mesuré dans cette version", () => {
    expect(result.notVerified.map((n) => n.code)).toEqual(expect.arrayContaining(["I3", "I14"]));
    expect(criterion(result, "I3")).toMatchObject({ status: "NOT_VERIFIED", points: null });
    expect(criterion(result, "T2")).toMatchObject({ status: "NOT_APPLICABLE", points: null });
  });

  it("chaque point attribué est justifié par une preuve", () => {
    const c1 = criterion(result, "C1");
    expect(c1).toMatchObject({ status: "PASS", points: 5 });
    expect(c1.evidence[0]).toMatchObject({ url: SITE_URL, excerpt: "Conseil data pour les dirigeants de PME à Abidjan" });
    expect(criterion(result, "E2").explanation).toMatch(/rendez-vous/);
    expect(criterion(result, "T3").evidence.length).toBeGreaterThanOrEqual(3);
  });

  it("mesure sitemap et vitesse quand ces données sont fournies", () => {
    const full = scoreSite(siteInput(fixture("complete"), { site: { sitemap: { found: true, validXml: true, urlCount: 12 }, performance: { lcpMs: 1800, cls: 0.02 } } }));
    expect(criterion(full, "I3")).toMatchObject({ status: "PASS", points: 2 });
    expect(criterion(full, "I14")).toMatchObject({ status: "PASS", points: 1 });
    expect(full.pillars.INDEXER.coverage).toBe(1);
  });

  it("est déterministe", () => {
    expect(scoreSite(siteInput(fixture("complete")))).toEqual(result);
  });
});

describe("site techniquement correct mais faible en conversion", () => {
  const result = scoreSite(siteInput(fixture("weak-conversion")));

  it("Indexer élevé, Enclencher et Tunnel faibles", () => {
    expectExplainable(result);
    expect(result.pillars.INDEXER.score).toBeGreaterThanOrEqual(22);
    expect(result.pillars.ENCLENCHER.score).toBeLessThanOrEqual(4);
    expect(result.pillars.TUNNEL.score).toBeLessThanOrEqual(8);
  });

  it("priorise les blocages de conversion en tête des recommandations", () => {
    const critical = result.recommendations.filter((r) => r.priority === "CRITIQUE").map((r) => r.criterionCode);
    expect(critical).toEqual(expect.arrayContaining(["E1", "E2", "T3", "T1"]));
    expect(result.recommendations[0].priority).toBe("CRITIQUE");
    expect(result.weaknesses[0].priority).toBe("CRITIQUE");
  });

  it("chaque recommandation est complète et compréhensible", () => {
    for (const r of result.recommendations) {
      expect(r.observation).toBeTruthy();
      expect(r.impact).toBeTruthy();
      expect(r.recommendation).toBeTruthy();
      expect(r.pointsAtStake).toBeGreaterThan(0);
    }
  });

  it("ne conclut pas à l'absence de formulaire s'il n'y a nulle part où le chercher", () => {
    expect(criterion(result, "E2").status).toBe("FAIL"); // pas de lien contact : constat observé
    const withContactLink = scoreSite(siteInput(fixture("weak-conversion").replace("<a href=\"/glossaire\">", "<a href=\"/contact\">Contact</a><a href=\"/glossaire\">")));
    expect(criterion(withContactLink, "E2")).toMatchObject({ status: "NOT_VERIFIED", points: null });
  });
});

describe("site avec peu de contenu", () => {
  const result = scoreSite(siteInput(fixture("thin")));

  it("signale en critique le contenu illisible sans JavaScript", () => {
    expectExplainable(result);
    expect(criterion(result, "I8")).toMatchObject({ status: "FAIL", priority: "CRITIQUE", points: 0 });
    expect(criterion(result, "I8").explanation).toMatch(/JavaScript/);
    expect(result.recommendations[0].priority).toBe("CRITIQUE");
  });

  it("ne mesure pas la lisibilité ni le bénéfice sans texte", () => {
    expect(criterion(result, "C6")).toMatchObject({ status: "NOT_VERIFIED", points: null });
    expect(criterion(result, "C4")).toMatchObject({ status: "NOT_VERIFIED", points: null });
  });

  it("ne conclut rien sur un contenu qu'il n'a pas pu lire", () => {
    for (const code of ["C1", "C3", "T3", "T4", "E1", "E2", "E6"]) {
      expect(criterion(result, code), code).toMatchObject({ status: "NOT_VERIFIED", points: null });
      expect(criterion(result, code).explanation).toMatch(/JavaScript/);
    }
    // Ce qui est observable dans le code reçu reste mesuré.
    expect(criterion(result, "I9")).toMatchObject({ status: "FAIL" });
    expect(criterion(result, "I10")).toMatchObject({ status: "FAIL" });
  });

  it("ne donne pas de score global : les données ne suffisent pas", () => {
    expect(result.scoreTotal).toBeNull();
    expect(result.status).toBe("NOT_VERIFIED");
    expect(result.notVerifiedReason).toMatch(/Clarifier/);
    expect(result.pillars.INDEXER.score).not.toBeNull();
  });
});

describe("site inaccessible", () => {
  it("erreur HTTP 500 : aucun score, mais le constat observé est remonté", () => {
    const result = scoreSite(failedInput({ code: "HTTP_ERROR", message: "", httpStatus: 500, url: SITE_URL }));
    expectExplainable(result);
    expect(result.scoreTotal).toBeNull();
    expect(result.status).toBe("NOT_VERIFIED");
    expect(result.notVerifiedReason).toMatch(/code HTTP 500/);
    for (const p of Object.values(result.pillars)) expect(p.score).toBeNull();
    expect(result.recommendations.map((r) => r.criterionCode)).toEqual(["I1"]);
    expect(result.recommendations[0].priority).toBe("CRITIQUE");
    expect(result.strengths).toEqual([]);
    expect(result.analyzedPages).toEqual([{ url: SITE_URL, role: "home", ok: false, reason: expect.stringContaining("500") }]);
  });

  it.each([401, 403, 429])("accès refusé au robot (HTTP %i) : non vérifié, jamais présenté comme une panne", (status) => {
    const result = scoreSite(failedInput({ code: "HTTP_ERROR", message: "", httpStatus: status, url: SITE_URL }));
    expectExplainable(result);
    expect(result.scoreTotal).toBeNull();
    expect(criterion(result, "I1")).toMatchObject({ status: "NOT_VERIFIED", points: null, priority: null });
    expect(result.recommendations).toEqual([]);
    expect(result.notVerifiedReason).toMatch(/protection anti-robot/);
    expect(result.notVerifiedReason).toContain(String(status));
  });

  it("délai dépassé : rien n'est conclu, aucune recommandation inventée", () => {
    const result = scoreSite(failedInput({ code: "TIMEOUT", message: "" }));
    expectExplainable(result);
    expect(result.scoreTotal).toBeNull();
    expect(result.recommendations).toEqual([]);
    expect(result.notVerified.length).toBeGreaterThanOrEqual(28);
    expect(result.notVerified[0].reason).toMatch(/n'a pas répondu à temps/);
  });

  it("aucune page fournie : non vérifié", () => {
    const result = scoreSite({ context: failedInput({ code: "TIMEOUT", message: "" }).context, site: {}, pages: [] });
    expect(result.scoreTotal).toBeNull();
    expect(result.notVerifiedReason).toMatch(/n'a pas été analysée/);
  });
});

describe("site sans données structurées", () => {
  const complete = scoreSite(siteInput(fixture("complete")));
  const result = scoreSite(siteInput(fixture("no-structured-data")));

  it("le critère d'identité échoue avec un constat explicite", () => {
    expectExplainable(result);
    expect(criterion(result, "I9")).toMatchObject({ status: "FAIL", points: 0, priority: "IMPORTANT" });
    expect(criterion(result, "I9").explanation).toMatch(/Aucune donnée structurée/);
    expect(result.recommendations.map((r) => r.criterionCode)).toContain("I9");
  });

  it("le reste du site garde ses points : seul ce qui manque est retiré", () => {
    expect(result.scoreTotal).toBeLessThan(complete.scoreTotal!);
    expect(result.pillars.CLARIFIER.score).toBe(complete.pillars.CLARIFIER.score);
    expect(result.pillars.ENCLENCHER.score).toBe(complete.pillars.ENCLENCHER.score);
  });

  it("une personne non déclarée réduit le critère « qui est derrière »", () => {
    expect(criterion(result, "T6").status).toBe("PARTIAL");
  });
});

describe("règles particulières", () => {
  it("noindex sur l'accueil → critique", () => {
    const html = fixture("complete").replace("<head>", '<head><meta name="robots" content="noindex">');
    const result = scoreSite(siteInput(html));
    expect(criterion(result, "I1")).toMatchObject({ status: "FAIL", priority: "CRITIQUE" });
  });

  it("cible déclarée absente du site → échec C3", () => {
    const result = scoreSite(siteInput(fixture("complete"), { context: { primaryTarget: "Hôpitaux publics" } }));
    expect(criterion(result, "C3")).toMatchObject({ status: "FAIL" });
  });

  it("questions de prospects : non vérifié avec une seule page, mesuré avec plusieurs", () => {
    const geoQueries = ["Quel cabinet de conseil data choisir à Abidjan ?", "Combien coûte un tableau de bord ?"];
    const single = scoreSite(siteInput(fixture("complete"), { context: { geoQueries } }));
    expect(criterion(single, "T2")).toMatchObject({ status: "NOT_VERIFIED", points: null });

    const page = (title: string, h1: string) => `<html><head><title>${title}</title></head><body><h1>${h1}</h1><h2>Section</h2></body></html>`;
    const multi = scoreSite(
      siteInput(fixture("complete"), {
        context: { geoQueries },
        extraPages: [
          { role: "offer", url: `${SITE_URL}offres/conseil-data`, html: page("Conseil data à Abidjan", "Choisir un cabinet de conseil data à Abidjan") },
          { role: "about", url: `${SITE_URL}a-propos`, html: page("À propos", "Notre équipe") },
        ],
      }),
    );
    expect(criterion(multi, "T2")).toMatchObject({ status: "PARTIAL" });
    expect(criterion(multi, "T2").missing[0]).toMatch(/Combien coûte/);
  });
});

describe("catalogue", () => {
  it("couvre 32 critères dont les points totalisent 25 / 30 / 25 / 20", () => {
    expect(CRITERIA).toHaveLength(32);
    for (const [pillar, meta] of Object.entries(PILLARS)) {
      expect(CRITERIA.filter((c) => c.pillar === pillar).reduce((n, c) => n + c.maxPoints, 0)).toBe(meta.maxPoints);
    }
  });

  it("ne contient aucune formulation interdite", () => {
    for (const c of CRITERIA) {
      expect(findForbiddenWording(`${c.label} ${c.question} ${c.impact} ${c.recommendation} ${c.strength}`), c.code).toEqual([]);
    }
  });

  it("le garde-fou détecte les promesses interdites", () => {
    for (const phrase of [
      "Vous serez recommandé par ChatGPT",
      "Devenez numéro 1 dans les IA",
      "Cette optimisation garantit une citation",
      "Première place garantie sur Google",
      "Perplexity vous citera",
    ]) {
      expect(findForbiddenWording(phrase), phrase).not.toEqual([]);
    }
    expect(findForbiddenWording("Peut maximiser vos chances d'être cité. Résultat non garanti.")).toEqual([]);
  });
});
