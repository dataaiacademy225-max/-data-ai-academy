/**
 * Métriques GEO du tableau de bord, calculées sur l'échantillon de réponses d'IA. Fonction pure.
 *
 * - Taux de mention : réponses où la marque apparaît / réponses analysées.
 * - Citations : réponses dont une source pointe vers le site de la marque.
 * - Part de voix : mentions de la marque / (mentions de la marque + mentions des concurrents suivis).
 *   Sans concurrent suivi, elle n'a pas de sens : « non mesurée » (null), jamais 100 %.
 *
 * Ce ne sont ni un score ni une mesure globale de visibilité : seulement des comptes sur un échantillon.
 * Démonstration et réel ne sont jamais additionnés.
 */

export type GeoRow = {
  runId: string;
  /** Date du lancement (fin, sinon mise en file). */
  runDate: Date;
  isDemo: boolean;
  brandMentioned: boolean | null;
  brandCited: boolean | null;
  brandRecommended: boolean | null;
  /** JSON stocké en base (EntityVisibility[]), relu de façon défensive. */
  competitorsMentioned: unknown;
};

export type GeoPoint = {
  runId: string;
  date: Date;
  analyzed: number;
  mentionRate: number;
  citations: number;
  shareOfVoice: number | null;
};

export type GeoMetrics = {
  scope: "real" | "demo" | "none";
  analyzed: number;
  mentioned: number;
  cited: number;
  recommended: number;
  /** null quand aucune réponse n'a été analysée. */
  mentionRate: number | null;
  /** null quand aucun concurrent n'est suivi dans l'échantillon. */
  shareOfVoice: number | null;
  brandMentions: number;
  competitorMentions: number;
  /** Un point par lancement, du plus ancien au plus récent (12 au plus). */
  timeline: GeoPoint[];
};

export const MAX_TIMELINE_POINTS = 12;

type Competitors = { tracked: number; mentioned: number };

function readCompetitors(value: unknown): Competitors {
  if (!Array.isArray(value)) return { tracked: 0, mentioned: 0 };
  let tracked = 0;
  let mentioned = 0;
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    tracked += 1;
    if ((item as { mentioned?: unknown }).mentioned === true) mentioned += 1;
  }
  return { tracked, mentioned };
}

type Tally = { analyzed: number; mentioned: number; cited: number; recommended: number; tracked: number; competitorMentions: number };

const emptyTally = (): Tally => ({ analyzed: 0, mentioned: 0, cited: 0, recommended: 0, tracked: 0, competitorMentions: 0 });

function add(tally: Tally, row: GeoRow) {
  const competitors = readCompetitors(row.competitorsMentioned);
  tally.analyzed += 1;
  if (row.brandMentioned) tally.mentioned += 1;
  if (row.brandCited) tally.cited += 1;
  if (row.brandRecommended) tally.recommended += 1;
  tally.tracked += competitors.tracked;
  tally.competitorMentions += competitors.mentioned;
}

function shareOf(tally: Tally): number | null {
  if (tally.tracked === 0) return null;
  const total = tally.mentioned + tally.competitorMentions;
  return total === 0 ? 0 : tally.mentioned / total;
}

export function computeGeoMetrics(rows: GeoRow[]): GeoMetrics {
  const real = rows.filter((row) => !row.isDemo);
  const scope = real.length > 0 ? "real" : rows.length > 0 ? "demo" : "none";
  const kept = scope === "real" ? real : rows;

  const total = emptyTally();
  const runs = new Map<string, { date: Date; tally: Tally }>();
  for (const row of kept) {
    add(total, row);
    const run = runs.get(row.runId) ?? { date: row.runDate, tally: emptyTally() };
    add(run.tally, row);
    runs.set(row.runId, run);
  }

  const timeline = [...runs.entries()]
    .sort(([, a], [, b]) => a.date.getTime() - b.date.getTime())
    .slice(-MAX_TIMELINE_POINTS)
    .map(([runId, { date, tally }]) => ({
      runId,
      date,
      analyzed: tally.analyzed,
      mentionRate: tally.mentioned / tally.analyzed,
      citations: tally.cited,
      shareOfVoice: shareOf(tally),
    }));

  return {
    scope,
    analyzed: total.analyzed,
    mentioned: total.mentioned,
    cited: total.cited,
    recommended: total.recommended,
    mentionRate: total.analyzed ? total.mentioned / total.analyzed : null,
    shareOfVoice: shareOf(total),
    brandMentions: total.mentioned,
    competitorMentions: total.competitorMentions,
    timeline,
  };
}
