import { describe, expect, it } from "vitest";
import { computeGeoMetrics, MAX_TIMELINE_POINTS, type GeoRow } from "@/server/ai-visibility/geo-metrics";

const competitor = (name: string, mentioned: boolean) => ({ name, mentioned, cited: false, recommended: false });

const row = (over: Partial<GeoRow>): GeoRow => ({
  runId: "run-1",
  runDate: new Date("2026-10-01T10:00:00Z"),
  isDemo: false,
  brandMentioned: false,
  brandCited: false,
  brandRecommended: false,
  competitorsMentioned: [],
  ...over,
});

describe("computeGeoMetrics", () => {
  it("calcule taux de mention, citations et part de voix sur l'échantillon", () => {
    const metrics = computeGeoMetrics([
      row({ brandMentioned: true, brandCited: true, competitorsMentioned: [competitor("A", true), competitor("B", false)] }),
      row({ brandMentioned: true, competitorsMentioned: [competitor("A", true), competitor("B", true)] }),
      row({ competitorsMentioned: [competitor("A", false), competitor("B", false)] }),
      row({ brandMentioned: true, brandRecommended: true, competitorsMentioned: [competitor("A", false), competitor("B", false)] }),
    ]);
    expect(metrics.scope).toBe("real");
    expect(metrics.analyzed).toBe(4);
    expect(metrics.mentionRate).toBe(0.75);
    expect(metrics.cited).toBe(1);
    expect(metrics.recommended).toBe(1);
    // 3 mentions de la marque, 3 mentions de concurrents.
    expect(metrics.shareOfVoice).toBe(0.5);
  });

  it("ne mesure pas la part de voix sans concurrent suivi (jamais 100 % par défaut)", () => {
    const metrics = computeGeoMetrics([row({ brandMentioned: true })]);
    expect(metrics.shareOfVoice).toBeNull();
    expect(metrics.timeline[0].shareOfVoice).toBeNull();
  });

  it("relit le JSON des concurrents de façon défensive", () => {
    const metrics = computeGeoMetrics([
      row({ brandMentioned: true, competitorsMentioned: "pas un tableau" }),
      row({ competitorsMentioned: [null, 3, competitor("A", true)] }),
    ]);
    expect(metrics.shareOfVoice).toBe(0.5);
  });

  it("ne mélange jamais démonstration et réel", () => {
    const metrics = computeGeoMetrics([
      row({ isDemo: true, brandMentioned: true, brandCited: true }),
      row({ brandMentioned: false }),
    ]);
    expect(metrics.scope).toBe("real");
    expect(metrics.analyzed).toBe(1);
    expect(metrics.cited).toBe(0);
    expect(computeGeoMetrics([row({ isDemo: true })]).scope).toBe("demo");
  });

  it("renvoie un état vide sans réponse analysée", () => {
    const metrics = computeGeoMetrics([]);
    expect(metrics).toMatchObject({ scope: "none", analyzed: 0, mentionRate: null, shareOfVoice: null, timeline: [] });
  });

  it("trie la chronologie par lancement et garde les plus récents", () => {
    const rows = Array.from({ length: MAX_TIMELINE_POINTS + 3 }, (_, i) =>
      row({ runId: `run-${i}`, runDate: new Date(Date.UTC(2026, 0, 1 + i)), brandCited: i % 2 === 0 }),
    ).reverse();
    const { timeline } = computeGeoMetrics(rows);
    expect(timeline).toHaveLength(MAX_TIMELINE_POINTS);
    expect(timeline[0].runId).toBe("run-3");
    expect(timeline.at(-1)?.runId).toBe(`run-${MAX_TIMELINE_POINTS + 2}`);
  });
});
