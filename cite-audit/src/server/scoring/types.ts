import type { CrawledPage, PageRole } from "@/server/crawler/types";

export type { PageRole };

/**
 * Types du moteur de scoring CITE. Le moteur est une fonction pure :
 * mêmes données d'analyse → même résultat, sans réseau ni base de données.
 */

export const SCORING_VERSION = "cite-1.0.0";

export type Pillar = "CLARIFIER" | "INDEXER" | "TUNNEL" | "ENCLENCHER";
export type Priority = "CRITIQUE" | "IMPORTANT" | "RECOMMANDE";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type Effort = "faible" | "moyen" | "élevé";

/**
 * PASS / PARTIAL / FAIL : mesuré.
 * NOT_APPLICABLE : le critère n'a pas de sens ici (ex. aucune image).
 * NOT_VERIFIED : la donnée nécessaire n'a pas été analysée → aucun point, aucune conclusion.
 */
export type CriterionStatus = "PASS" | "PARTIAL" | "FAIL" | "NOT_APPLICABLE" | "NOT_VERIFIED";

/** Une page soumise au scoring : réussie (faits observés) ou en échec (raison connue). */
export type PageInput = CrawledPage;

/** Observations à l'échelle du site. Absentes = non analysées = critère « non vérifié ». */
export type SiteSignals = {
  sitemap?: { found: boolean; validXml: boolean; urlCount: number };
  performance?: { lcpMs: number; cls: number };
  brokenLinks?: { checked: number; broken: string[] };
};

/** Ce que l'entreprise a déclaré dans son projet : sert à vérifier si le site l'exprime. */
export type ScoringContext = {
  companyName: string;
  sector: string;
  primaryTarget: string;
  city: string | null;
  country: string;
  geoQueries: string[];
};

export type ScoringInput = {
  context: ScoringContext;
  pages: PageInput[];
  site: SiteSignals;
};

export type Evidence = { url?: string; label: string; excerpt?: string };

/** Ce qu'une règle renvoie : un constat mesuré, sans points (calculés par le moteur). */
export type Outcome =
  | {
      status: "PASS" | "PARTIAL" | "FAIL";
      /** Part des points obtenus (1 pour PASS, 0 pour FAIL, entre les deux pour PARTIAL). */
      ratio: number;
      confidence: Confidence;
      /** Pourquoi ce résultat, en une ou deux phrases simples. */
      explanation: string;
      evidence: Evidence[];
      missing: string[];
      /** Priorité si différente de celle du catalogue (ex. blocage total). */
      priority?: Priority;
    }
  | { status: "NOT_APPLICABLE" | "NOT_VERIFIED"; explanation: string };

export type CriterionResult = {
  code: string;
  pillar: Pillar;
  label: string;
  question: string;
  maxPoints: number;
  /** null = non vérifié ou sans objet : jamais 0 par défaut. */
  points: number | null;
  status: CriterionStatus;
  confidence: Confidence | null;
  explanation: string;
  evidence: Evidence[];
  missing: string[];
  priority: Priority | null;
};

export type PillarResult = {
  pillar: Pillar;
  label: string;
  question: string;
  maxPoints: number;
  /** null = données insuffisantes pour conclure (« non vérifié »). */
  score: number | null;
  /** Part des points du pilier réellement mesurée (critères sans objet exclus). */
  coverage: number;
  /** Score calculé sur une couverture partielle : à lire comme une tendance. */
  indicative: boolean;
  criteria: CriterionResult[];
};

export type Recommendation = {
  criterionCode: string;
  pillar: Pillar;
  priority: Priority;
  title: string;
  observation: string;
  evidence: Evidence[];
  impact: string;
  recommendation: string;
  effort: Effort;
  /** Points récupérables si le signal est amélioré (indicateur interne). */
  pointsAtStake: number;
};

export type Strength = { criterionCode: string; pillar: Pillar; title: string; detail: string };
export type Weakness = { criterionCode: string; pillar: Pillar; priority: Priority; title: string; detail: string };

export type ScoringResult = {
  scoringVersion: string;
  status: "SCORED" | "INDICATIVE" | "NOT_VERIFIED";
  /** null quand les données ne permettent pas de conclure. */
  scoreTotal: number | null;
  /** Part des points du barème réellement mesurée sur l'ensemble des piliers (0 à 1). */
  coverage: number;
  notVerifiedReason: string | null;
  pillars: Record<Pillar, PillarResult>;
  strengths: Strength[];
  weaknesses: Weakness[];
  recommendations: Recommendation[];
  notVerified: { code: string; label: string; reason: string }[];
  analyzedPages: { url: string; role: PageRole; ok: boolean; reason?: string }[];
  method: string;
  disclaimer: string;
};
