import { describe, expect, it } from "vitest";
import { buildComparison, COMPARISON_WARNING, readReport, type SiteInput } from "@/server/report/comparison";
import { scoreSite } from "@/server/scoring";
import { findForbiddenWording } from "@/server/scoring/wording-guard";
import { analysisFromHtml, fixture, SITE_URL } from "../../helpers/scoring-fixtures";

const context = { companyName: "Cabinet", sector: "Conseil", primaryTarget: "PME", city: "Abidjan", country: "CI", geoQueries: [] };
const report = (name: string) =>
  scoreSite({ context, pages: [{ role: "home", url: SITE_URL, ok: true, analysis: analysisFromHtml(fixture(name)) }], site: {} });
const site = (over: Partial<SiteInput>): SiteInput => ({ name: "Site", url: SITE_URL, isYou: false, state: "DONE", report: null, auditedAt: null, ...over });

describe("comparaison avec les concurrents", () => {
  const weak = report("weak-conversion");
  const strong = report("complete");

  it("liste ce qu'un concurrent fait mieux, et les avantages du site, sans compter le non vérifié", () => {
    const view = buildComparison([site({ name: "Vous", isYou: true, report: weak }), site({ name: "Rival", report: strong })]);
    expect(view.comparedCompetitors).toBe(1);
    expect(view.gaps.length).toBeGreaterThan(0);
    for (const gap of view.gaps) {
      expect(["PARTIAL", "FAIL"]).toContain(gap.yourStatus);
      expect(gap.ahead.map((a) => a.name)).toEqual(["Rival"]);
    }
    // Ordre : priorité critique d'abord.
    const ranks = view.gaps.map((g) => ({ CRITIQUE: 0, IMPORTANT: 1, RECOMMANDE: 2 })[g.priority]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    // Symétrique : vu du concurrent, ses avantages couvrent nos écarts.
    const reverse = buildComparison([site({ name: "Rival", isYou: true, report: strong }), site({ name: "Vous", report: weak })]);
    expect(reverse.advantages.map((a) => a.code).sort()).toEqual(expect.arrayContaining(view.gaps.filter((g) => g.ahead[0].status === "PASS").map((g) => g.code)));
  });

  it("n'en tire aucune conclusion sans audit du site, ni avec un concurrent en cours, en échec ou d'un autre barème", () => {
    const other = { ...strong, scoringVersion: "cite-0.9.0" };
    const view = buildComparison([
      site({ name: "Vous", isYou: true, report: weak }),
      site({ name: "En cours", state: "PENDING" }),
      site({ name: "Échec", state: "FAILED" }),
      site({ name: "Ancien", report: other }),
    ]);
    expect(view).toMatchObject({ gaps: [], advantages: [], comparedCompetitors: 0 });
    expect(view.sites.find((s) => s.name === "Ancien")?.otherVersion).toBe(true);
    expect(buildComparison([site({ name: "Vous", isYou: true, state: "FAILED" }), site({ report: strong })]).comparedCompetitors).toBe(0);
  });

  it("relit le rapport stocké de façon défensive et n'emploie aucune formulation interdite", () => {
    expect(readReport(null)).toBeNull();
    expect(readReport({ scoringVersion: "cite-1.1.0" })).toBeNull();
    expect(readReport(JSON.parse(JSON.stringify(weak)))?.scoreTotal).toBe(weak.scoreTotal);
    expect(findForbiddenWording(COMPARISON_WARNING)).toEqual([]);
  });
});
