import { CRITERIA, PILLARS, type CriterionDefinition } from "@/server/scoring/catalog";
import { C1, C2, C3, C4, C5, C6 } from "@/server/scoring/criteria/clarifier";
import { E1, E2, E3, E4, E5, E6 } from "@/server/scoring/criteria/enclencher";
import { I1, I10, I11, I12, I13, I14, I2, I3, I4, I5, I6, I7, I8, I9 } from "@/server/scoring/criteria/indexer";
import { buildView, errorReason, type Rule } from "@/server/scoring/criteria/shared";
import { T1, T2, T3, T4, T5, T6 } from "@/server/scoring/criteria/tunnel";
import {
  SCORING_VERSION,
  type CriterionResult,
  type Outcome,
  type Pillar,
  type PillarResult,
  type Priority,
  type Recommendation,
  type ScoringInput,
  type ScoringResult,
} from "@/server/scoring/types";

export const RULES: Record<string, Rule> = {
  C1, C2, C3, C4, C5, C6,
  I1, I2, I3, I4, I5, I6, I7, I8, I9, I10, I11, I12, I13, I14,
  T1, T2, T3, T4, T5, T6,
  E1, E2, E3, E4, E5, E6,
};

/** En dessous de cette part de points mesurés, un pilier n'est pas noté (« non vérifié »). */
export const MIN_COVERAGE = 0.5;
/** En dessous de cette part, le score du pilier est affiché comme indicatif. */
export const INDICATIVE_BELOW = 0.7;

export const PRIORITY_RANK: Record<Priority, number> = { CRITIQUE: 0, IMPORTANT: 1, RECOMMANDE: 2 };
const EFFORT_RANK = { faible: 0, moyen: 1, élevé: 2 } as const;
const PILLAR_ORDER: Pillar[] = ["CLARIFIER", "INDEXER", "TUNNEL", "ENCLENCHER"];

export const DISCLAIMER =
  "Le score CITE est un indicateur interne de Data & AI Academy, calculé à partir des signaux observables sur les pages analysées. " +
  "Ce n'est pas une mesure de Google, ChatGPT, Perplexity ou Gemini. Il ne garantit aucune position dans les moteurs ni aucune citation par une IA : " +
  "les recommandations peuvent renforcer la compréhension de votre marque et maximiser vos chances d'être trouvé et cité. Résultat non garanti.";

export const METHOD =
  "Chaque critère rapporte des points selon une règle fixe et publique : totalité des points si le signal est présent, une partie s'il est incomplet, aucun s'il est absent. " +
  "Un critère « non vérifié » (donnée non analysée) ou « sans objet » ne rapporte ni ne retire de points : il est exclu du calcul, et le score du pilier est rapporté aux seuls points mesurés. " +
  `Un pilier n'est noté que si au moins ${MIN_COVERAGE * 100} % de ses points ont pu être mesurés ; en dessous de ${INDICATIVE_BELOW * 100} %, son score est indicatif. ` +
  "Le score global n'est donné que si les quatre piliers sont notés.";

const round1 = (n: number) => Math.round(n * 10) / 10;
const roundHalf = (n: number) => Math.round(n * 2) / 2;

function toCriterionResult(def: CriterionDefinition, outcome: Outcome): CriterionResult {
  const base = { code: def.code, pillar: def.pillar, label: def.label, question: def.question, maxPoints: def.maxPoints };
  if (!("ratio" in outcome)) {
    return { ...base, points: null, status: outcome.status, confidence: null, explanation: outcome.explanation, evidence: [], missing: [], priority: null };
  }
  return {
    ...base,
    points: round1(def.maxPoints * outcome.ratio),
    status: outcome.status,
    confidence: outcome.confidence,
    explanation: outcome.explanation,
    evidence: outcome.evidence,
    missing: outcome.missing,
    priority: outcome.status === "PASS" ? null : (outcome.priority ?? def.priority),
  };
}

const isMeasured = (c: CriterionResult) => c.status === "PASS" || c.status === "PARTIAL" || c.status === "FAIL";

function scorePillar(pillar: Pillar, criteria: CriterionResult[]): PillarResult {
  const meta = PILLARS[pillar];
  const applicable = criteria.filter((c) => c.status !== "NOT_APPLICABLE");
  const measured = criteria.filter(isMeasured);
  const applicableMax = applicable.reduce((n, c) => n + c.maxPoints, 0);
  const measuredMax = measured.reduce((n, c) => n + c.maxPoints, 0);
  const obtained = measured.reduce((n, c) => n + (c.points ?? 0), 0);
  const coverage = applicableMax === 0 ? 0 : measuredMax / applicableMax;
  const scored = coverage >= MIN_COVERAGE && measuredMax > 0;
  return {
    pillar,
    label: meta.label,
    question: meta.question,
    maxPoints: meta.maxPoints,
    score: scored ? roundHalf((meta.maxPoints * obtained) / measuredMax) : null,
    coverage: round1(coverage * 100) / 100,
    indicative: scored && coverage < INDICATIVE_BELOW,
    criteria,
  };
}

function globalCoverage(criteria: CriterionResult[]): number {
  const applicable = criteria.filter((c) => c.status !== "NOT_APPLICABLE").reduce((n, c) => n + c.maxPoints, 0);
  const measured = criteria.filter(isMeasured).reduce((n, c) => n + c.maxPoints, 0);
  return applicable === 0 ? 0 : Math.round((measured / applicable) * 100) / 100;
}

/**
 * Calcule le score CITE à partir des données d'analyse. Fonction pure et déterministe.
 * Aucune donnée non analysée n'est transformée en conclusion : elle devient « non vérifié ».
 */
export function scoreSite(input: ScoringInput): ScoringResult {
  const view = buildView(input);
  const criteria = CRITERIA.map((def) => toCriterionResult(def, RULES[def.code](view)));

  const pillars = Object.fromEntries(
    PILLAR_ORDER.map((p) => [p, scorePillar(p, criteria.filter((c) => c.pillar === p))]),
  ) as Record<Pillar, PillarResult>;

  const unscored = PILLAR_ORDER.filter((p) => pillars[p].score === null);
  const scoreTotal = unscored.length === 0 ? Math.round(PILLAR_ORDER.reduce((n, p) => n + (pillars[p].score ?? 0), 0)) : null;
  const indicative = PILLAR_ORDER.some((p) => pillars[p].indicative);

  let notVerifiedReason: string | null = null;
  if (scoreTotal === null) {
    notVerifiedReason = view.homeError
      ? `Score non calculé : la page d'accueil n'a pas pu être analysée car ${errorReason(view.homeError)}.`
      : !view.home
        ? "Score non calculé : la page d'accueil n'a pas été analysée."
        : `Score non calculé : données insuffisantes pour ${unscored.map((p) => PILLARS[p].label).join(", ")}.`;
  }

  const defs = Object.fromEntries(CRITERIA.map((d) => [d.code, d]));
  const toImprove = criteria.filter((c) => c.status === "FAIL" || c.status === "PARTIAL");

  const recommendations: Recommendation[] = toImprove
    .map((c) => ({
      criterionCode: c.code,
      pillar: c.pillar,
      priority: c.priority!,
      title: c.label,
      observation: c.explanation,
      evidence: c.evidence,
      impact: defs[c.code].impact,
      recommendation: defs[c.code].recommendation,
      effort: defs[c.code].effort,
      pointsAtStake: round1(c.maxPoints - (c.points ?? 0)),
    }))
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        b.pointsAtStake - a.pointsAtStake ||
        EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort] ||
        a.criterionCode.localeCompare(b.criterionCode),
    );

  const strengths = criteria
    .filter((c) => c.status === "PASS")
    .sort((a, b) => b.maxPoints - a.maxPoints)
    .map((c) => ({ criterionCode: c.code, pillar: c.pillar, title: defs[c.code].strength, detail: c.explanation }));

  const weaknesses = recommendations.map((r) => ({
    criterionCode: r.criterionCode,
    pillar: r.pillar,
    priority: r.priority,
    title: r.title,
    detail: r.observation,
  }));

  return {
    scoringVersion: SCORING_VERSION,
    status: scoreTotal === null ? "NOT_VERIFIED" : indicative ? "INDICATIVE" : "SCORED",
    scoreTotal,
    coverage: globalCoverage(criteria),
    notVerifiedReason,
    pillars,
    strengths,
    weaknesses,
    recommendations,
    notVerified: criteria.filter((c) => c.status === "NOT_VERIFIED").map((c) => ({ code: c.code, label: c.label, reason: c.explanation })),
    analyzedPages: input.pages.map((p) =>
      p.ok ? { url: p.analysis.finalUrl, role: p.role, ok: true } : { url: p.url, role: p.role, ok: false, reason: errorReason(p.error) },
    ),
    method: METHOD,
    disclaimer: DISCLAIMER,
  };
}
