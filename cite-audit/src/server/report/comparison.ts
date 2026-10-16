import { CRITERIA_BY_CODE } from "@/server/scoring/catalog";
import type { CriterionResult, Evidence, Pillar, Priority, ScoringResult } from "@/server/scoring/types";

/**
 * Comparaison avec les concurrents (fonction pure, testée).
 * Compare critère par critère des signaux observés, à une date donnée : ce n'est ni un classement Google
 * ni une mesure de la visibilité dans les IA. Un critère non vérifié d'un côté n'est jamais comparé.
 */

export const COMPARISON_WARNING =
  "Comparaison indicative de signaux observables, à la date de chaque audit et sur 15 pages au plus par site. Ce n'est ni un classement Google ni une mesure de la visibilité dans les IA : résultat non garanti.";

export type SiteState = "PENDING" | "DONE" | "FAILED";

export type SiteInput = {
  name: string;
  url: string;
  isYou: boolean;
  state: SiteState;
  report: ScoringResult | null;
  auditedAt: Date | null;
};

export type ComparedSite = {
  name: string;
  url: string;
  isYou: boolean;
  state: SiteState;
  /** null : audit en cours, en échec ou score « non vérifié ». */
  scoreTotal: number | null;
  pillars: Record<Pillar, number | null>;
  auditedAt: Date | null;
  /** Rapport d'un autre barème que le vôtre : affiché, mais exclu de la comparaison par critère. */
  otherVersion: boolean;
};

export type Gap = {
  code: string;
  label: string;
  pillar: Pillar;
  priority: Priority;
  yourStatus: "PARTIAL" | "FAIL";
  /** Concurrents qui font mieux sur ce critère, avec une preuve observée chez eux. */
  ahead: { name: string; status: "PASS" | "PARTIAL"; evidence: Evidence | null }[];
  recommendation: string;
};

export type Advantage = { code: string; label: string; pillar: Pillar; behind: string[] };

export type ComparisonView = {
  sites: ComparedSite[];
  gaps: Gap[];
  advantages: Advantage[];
  /** Nombre de concurrents réellement comparables critère par critère. */
  comparedCompetitors: number;
};

const PILLARS: Pillar[] = ["CLARIFIER", "INDEXER", "TUNNEL", "ENCLENCHER"];
const RANK: Partial<Record<CriterionResult["status"], number>> = { FAIL: 0, PARTIAL: 1, PASS: 2 };
const PRIORITY_RANK: Record<Priority, number> = { CRITIQUE: 0, IMPORTANT: 1, RECOMMANDE: 2 };

/** Rapport enregistré relu de façon défensive (JSON stocké en base). */
export function readReport(value: unknown): ScoringResult | null {
  const r = value as Partial<ScoringResult> | null;
  if (!r || typeof r !== "object" || typeof r.scoringVersion !== "string" || !r.scoringVersion.startsWith("cite-")) return null;
  if (!r.pillars || PILLARS.some((p) => !Array.isArray(r.pillars?.[p]?.criteria))) return null;
  return r as ScoringResult;
}

function criteriaByCode(report: ScoringResult): Map<string, CriterionResult> {
  return new Map(PILLARS.flatMap((p) => report.pillars[p].criteria.map((c) => [c.code, c] as const)));
}

export function buildComparison(inputs: SiteInput[]): ComparisonView {
  const you = inputs.find((s) => s.isYou);
  const version = you?.state === "DONE" ? you.report?.scoringVersion : undefined;

  const sites: ComparedSite[] = inputs.map((s) => {
    const report = s.state === "DONE" ? s.report : null;
    return {
      name: s.name,
      url: s.url,
      isYou: s.isYou,
      state: s.state,
      scoreTotal: report?.scoreTotal ?? null,
      pillars: Object.fromEntries(PILLARS.map((p) => [p, report?.pillars[p].score ?? null])) as Record<Pillar, number | null>,
      auditedAt: s.auditedAt,
      otherVersion: !!report && !!version && report.scoringVersion !== version,
    };
  });

  const yourReport = you?.state === "DONE" ? you.report : null;
  const competitors = inputs.filter(
    (s): s is SiteInput & { report: ScoringResult } =>
      !s.isYou && s.state === "DONE" && !!s.report && s.report.scoringVersion === version,
  );
  if (!yourReport || competitors.length === 0) return { sites, gaps: [], advantages: [], comparedCompetitors: 0 };

  const theirs = competitors.map((c) => ({ name: c.name, criteria: criteriaByCode(c.report) }));
  const gaps: Gap[] = [];
  const advantages: Advantage[] = [];

  for (const mine of criteriaByCode(yourReport).values()) {
    const myRank = RANK[mine.status];
    if (myRank === undefined) continue; // non vérifié ou sans objet chez vous : pas de comparaison
    const measured = theirs.flatMap(({ name, criteria }) => {
      const c = criteria.get(mine.code);
      const rank = c ? RANK[c.status] : undefined;
      return c && rank !== undefined ? [{ name, c, rank }] : [];
    });
    if (measured.length === 0) continue;

    const ahead = measured.filter((m) => m.rank > myRank);
    if (ahead.length > 0 && (mine.status === "PARTIAL" || mine.status === "FAIL")) {
      const def = CRITERIA_BY_CODE[mine.code];
      gaps.push({
        code: mine.code,
        label: mine.label,
        pillar: mine.pillar,
        priority: mine.priority ?? def?.priority ?? "RECOMMANDE",
        yourStatus: mine.status,
        ahead: ahead.map((m) => ({
          name: m.name,
          status: m.c.status as "PASS" | "PARTIAL",
          evidence: m.c.evidence.find((e) => e.excerpt || e.url) ?? m.c.evidence[0] ?? null,
        })),
        recommendation: def?.recommendation ?? "",
      });
    }
    if (measured.every((m) => m.rank < myRank)) {
      advantages.push({ code: mine.code, label: mine.label, pillar: mine.pillar, behind: measured.map((m) => m.name) });
    }
  }

  const maxPoints = (code: string) => CRITERIA_BY_CODE[code]?.maxPoints ?? 0;
  gaps.sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      b.ahead.length - a.ahead.length ||
      maxPoints(b.code) - maxPoints(a.code) ||
      a.code.localeCompare(b.code),
  );
  advantages.sort((a, b) => b.behind.length - a.behind.length || maxPoints(b.code) - maxPoints(a.code) || a.code.localeCompare(b.code));

  return { sites, gaps, advantages, comparedCompetitors: competitors.length };
}
