import { describe, expect, it } from "vitest";
import { buildScoreTrend, MAX_TREND_POINTS, type TrendAudit } from "@/server/report/trend";

let n = 0;
const audit = (day: number, total: number | null, over: Partial<TrendAudit> = {}): TrendAudit => ({
  id: `a${++n}`,
  finishedAt: new Date(Date.UTC(2026, 9, day)),
  scoringVersion: "cite-1.1.0",
  scoreTotal: total,
  scoreClarifier: total === null ? null : 15,
  scoreIndexer: total === null ? null : 25,
  scoreTunnel: total === null ? null : 20,
  scoreEnclencher: total === null ? null : 15,
  ...over,
});

describe("buildScoreTrend", () => {
  it("trie par date et calcule l'écart avec l'audit précédent, pilier par pilier", () => {
    const trend = buildScoreTrend([
      audit(10, 89, { scoreClarifier: 17.5 }),
      audit(1, 82, { scoreClarifier: 15 }),
    ]);
    expect(trend.points.map((p) => p.total)).toEqual([82, 89]);
    expect(trend.delta).toEqual({ total: 7, pillars: { Clarifier: 2.5, Indexer: 0, Tunnel: 0, Enclencher: 0 } });
  });

  it("ignore les audits non notés : jamais comptés comme zéro", () => {
    const trend = buildScoreTrend([audit(1, 80), audit(2, null), audit(3, 85, { finishedAt: null })]);
    expect(trend.points.map((p) => p.total)).toEqual([80]);
    expect(trend.delta).toBeNull();
  });

  it("ne compare que les audits du barème le plus récent", () => {
    const trend = buildScoreTrend([audit(1, 60, { scoringVersion: "cite-1.0.0" }), audit(2, 80), audit(3, 84)]);
    expect(trend.scoringVersion).toBe("cite-1.1.0");
    expect(trend.points.map((p) => p.total)).toEqual([80, 84]);
    expect(trend.olderVersionCount).toBe(1);
  });

  it("un pilier non noté donne un écart non mesuré", () => {
    const trend = buildScoreTrend([audit(1, 80), audit(2, 82, { scoreTunnel: null })]);
    expect(trend.delta?.pillars.Tunnel).toBeNull();
  });

  it("garde les audits les plus récents et gère l'absence d'audit", () => {
    const many = Array.from({ length: MAX_TREND_POINTS + 5 }, (_, i) => audit(i + 1, 50 + i));
    expect(buildScoreTrend(many).points).toHaveLength(MAX_TREND_POINTS);
    expect(buildScoreTrend(many).points.at(-1)?.total).toBe(50 + MAX_TREND_POINTS + 4);
    expect(buildScoreTrend([])).toEqual({ scoringVersion: null, points: [], delta: null, olderVersionCount: 0 });
  });
});
