import { describe, expect, it } from "vitest";
import { buildReportView, CRITERION_META, metaFor, rankRecommendations } from "@/server/report/view";
import { CRITERIA, findForbiddenWording, scoreSite } from "@/server/scoring";
import type { Recommendation } from "@/server/scoring/types";
import { failedInput, fixture, siteInput, SITE_URL } from "../../helpers/scoring-fixtures";

const rec = (over: Partial<Recommendation>): Recommendation => ({
  criterionCode: "C1",
  pillar: "CLARIFIER",
  priority: "IMPORTANT",
  title: "t",
  observation: "o",
  evidence: [],
  impact: "i",
  recommendation: "r",
  effort: "moyen",
  pointsAtStake: 2,
  ...over,
});

describe("présentation du rapport", () => {
  it("chaque critère du barème a un responsable et un frein formulé, sans promesse interdite", () => {
    for (const c of CRITERIA) {
      const meta = CRITERION_META[c.code];
      expect(meta, c.code).toBeDefined();
      expect(findForbiddenWording(meta.issue), c.code).toEqual([]);
    }
    expect(Object.keys(CRITERION_META)).toHaveLength(CRITERIA.length);
  });

  it("priorités : gravité d'abord, puis « être trouvé » avant la conversion, puis l'effort le plus faible", () => {
    const ranked = rankRecommendations([
      rec({ criterionCode: "E2", pillar: "ENCLENCHER", priority: "CRITIQUE", effort: "faible", pointsAtStake: 5 }),
      rec({ criterionCode: "C1", pillar: "CLARIFIER", priority: "CRITIQUE", effort: "moyen", pointsAtStake: 1 }),
      rec({ criterionCode: "I9", pillar: "INDEXER", priority: "CRITIQUE", effort: "faible", pointsAtStake: 1 }),
      rec({ criterionCode: "T3", pillar: "TUNNEL", priority: "IMPORTANT", effort: "faible", pointsAtStake: 9 }),
    ]);
    expect(ranked.map((r) => r.criterionCode)).toEqual(["I9", "C1", "E2", "T3"]);
  });

  it("sépare les deux questions, 3 priorités au plus chacune, et met à part le travail du prestataire web", () => {
    const report = scoreSite(siteInput(fixture("weak-conversion")));
    const view = buildReportView(report);
    expect(view.groups.map((g) => g.id)).toEqual(["FOUND", "CONVERT"]);
    for (const g of view.groups) {
      expect(g.top.length).toBeLessThanOrEqual(3);
      for (const r of g.webActions) expect(metaFor(r.criterionCode).owner).toBe("WEB");
      for (const r of g.ownActions) expect(metaFor(r.criterionCode).owner).not.toBe("WEB");
      expect(g.ownActions.length + g.webActions.length).toBe(
        report.recommendations.filter((r) => (g.id === "FOUND" ? ["CLARIFIER", "INDEXER"] : ["TUNNEL", "ENCLENCHER"]).includes(r.pillar)).length,
      );
    }
    // Aucune recommandation perdue ni dupliquée.
    const all = view.groups.flatMap((g) => [...g.ownActions, ...g.webActions]).map((r) => r.criterionCode).sort();
    expect(all).toEqual(report.recommendations.map((r) => r.criterionCode).sort());
  });

  it("diagnostic : nomme les freins réels, rappelle que la réputation hors site n'est pas mesurée", () => {
    const report = scoreSite(siteInput(fixture("weak-conversion")));
    const view = buildReportView(report);
    expect(view.diagnosis).toHaveLength(3);
    const convert = view.groups.find((g) => g.id === "CONVERT")!;
    if (convert.top.length > 0 && convert.ratio !== null && convert.ratio < 0.8) {
      expect(view.diagnosis[1]).toContain(metaFor(convert.top[0].criterionCode).issue);
    }
    expect(view.diagnosis[2]).toMatch(/réputation ailleurs/);
    for (const s of [...view.diagnosis, ...view.notMeasured]) expect(findForbiddenWording(s), s).toEqual([]);
  });

  it("site complet : le diagnostic dit que les bases sont en place, sans inventer de frein", () => {
    const report = scoreSite(
      siteInput(fixture("complete"), { site: { sitemap: { found: true, validXml: true, urlCount: 12 }, performance: { lcpMs: 1800, cls: 0.02 } } }),
    );
    const view = buildReportView(report);
    const found = view.groups.find((g) => g.id === "FOUND")!;
    if (found.ratio !== null && found.ratio >= 0.8 && !found.top.some((r) => r.priority === "CRITIQUE")) {
      expect(view.diagnosis[0]).toMatch(/les bases sont en place/);
    }
  });

  it("site illisible : aucun frein inventé, renvoi vers les limites", () => {
    const report = scoreSite(failedInput({ code: "TIMEOUT", message: "", url: SITE_URL }));
    const view = buildReportView(report);
    expect(view.diagnosis[0]).toMatch(/pas pu analyser votre site|pas pu mesurer/);
    expect(view.diagnosis.join(" ")).not.toMatch(/Ce qui freine/);
  });

  it("indique toujours ce que l'audit ne mesure pas, dont la vitesse quand elle n'est pas mesurée", () => {
    const view = buildReportView(scoreSite(siteInput(fixture("thin"))));
    expect(view.notMeasured.join(" ")).toMatch(/fiche Google/);
    expect(view.notMeasured.join(" ")).toMatch(/Search Console/);
    expect(view.notMeasured.join(" ")).toMatch(/vitesse d'affichage/);
  });
});
