/**
 * Évolution du score CITE d'un projet, audit après audit. Fonction pure.
 *
 * - Seuls les audits notés (score global calculé) sont retenus : un audit « non vérifié » n'est pas un zéro.
 * - Seuls les audits du barème le plus récent sont comparés : changer de barème change la mesure.
 */

export type TrendAudit = {
  id: string;
  finishedAt: Date | null;
  scoringVersion: string;
  scoreTotal: number | null;
  scoreClarifier: number | null;
  scoreIndexer: number | null;
  scoreTunnel: number | null;
  scoreEnclencher: number | null;
};

export type TrendPillar = "Clarifier" | "Indexer" | "Tunnel" | "Enclencher";

export type TrendPoint = {
  id: string;
  date: Date;
  total: number;
  pillars: Record<TrendPillar, number | null>;
};

export type ScoreTrend = {
  scoringVersion: string | null;
  points: TrendPoint[];
  /** Écart entre le dernier audit noté et le précédent ; null s'il n'y a qu'un audit noté. */
  delta: { total: number; pillars: Record<TrendPillar, number | null> } | null;
  /** Audits notés avec un ancien barème, écartés de la comparaison. */
  olderVersionCount: number;
};

export const MAX_TREND_POINTS = 20;

const pillarsOf = (a: TrendAudit): Record<TrendPillar, number | null> => ({
  Clarifier: a.scoreClarifier,
  Indexer: a.scoreIndexer,
  Tunnel: a.scoreTunnel,
  Enclencher: a.scoreEnclencher,
});

const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((a - b) * 10) / 10);

export function buildScoreTrend(audits: TrendAudit[]): ScoreTrend {
  const scored = audits
    .filter((a): a is TrendAudit & { scoreTotal: number; finishedAt: Date } => a.scoreTotal !== null && a.finishedAt !== null)
    .sort((a, b) => a.finishedAt.getTime() - b.finishedAt.getTime());
  const latest = scored.at(-1);
  if (!latest) return { scoringVersion: null, points: [], delta: null, olderVersionCount: 0 };

  const sameVersion = scored.filter((a) => a.scoringVersion === latest.scoringVersion);
  const points = sameVersion.slice(-MAX_TREND_POINTS).map((a) => ({ id: a.id, date: a.finishedAt, total: a.scoreTotal, pillars: pillarsOf(a) }));

  const [previous, last] = points.slice(-2);
  const delta =
    points.length >= 2
      ? {
          total: last.total - previous.total,
          pillars: {
            Clarifier: diff(last.pillars.Clarifier, previous.pillars.Clarifier),
            Indexer: diff(last.pillars.Indexer, previous.pillars.Indexer),
            Tunnel: diff(last.pillars.Tunnel, previous.pillars.Tunnel),
            Enclencher: diff(last.pillars.Enclencher, previous.pillars.Enclencher),
          },
        }
      : null;

  return { scoringVersion: latest.scoringVersion, points, delta, olderVersionCount: scored.length - sameVersion.length };
}
