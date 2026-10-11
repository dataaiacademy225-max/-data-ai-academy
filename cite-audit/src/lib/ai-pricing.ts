/**
 * Estimation du coût d'une série de requêtes IA, AVANT lancement. Fonction pure (utilisable côté client :
 * aucun secret). Tarifs publics relevés en octobre 2026 ; ils peuvent changer : l'estimation est une
 * fourchette indicative et le coût réel renvoyé par l'API, quand il existe, prime.
 */

export const PRICES_AS_OF = "octobre 2026";

export type ModelPricing = {
  /** Dollars US par million de jetons. */
  inputPerMillion: number;
  outputPerMillion: number;
  /** Frais par requête (recherche web incluse), fourchette selon la profondeur de recherche. */
  requestFeeMin: number;
  requestFeeMax: number;
};

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "perplexity/sonar": { inputPerMillion: 1, outputPerMillion: 1, requestFeeMin: 0.005, requestFeeMax: 0.014 },
  sonar: { inputPerMillion: 1, outputPerMillion: 1, requestFeeMin: 0.005, requestFeeMax: 0.012 },
  "sonar-pro": { inputPerMillion: 3, outputPerMillion: 15, requestFeeMin: 0.006, requestFeeMax: 0.014 },
};

/** Hypothèses de longueur de réponse (jetons) : une réponse d'assistant fait en général quelques centaines de mots. */
const OUTPUT_TOKENS = { min: 300, max: 1200 };

export type CostEstimate = { queries: number; minUsd: number; maxUsd: number; known: boolean };

const tokensOf = (text: string) => Math.ceil(text.length / 4) + 20;
const roundCents = (n: number) => Math.ceil(n * 100) / 100;

export function estimateCost(model: string, queries: string[]): CostEstimate {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return { queries: queries.length, minUsd: 0, maxUsd: 0, known: false };
  let min = 0;
  let max = 0;
  for (const q of queries) {
    const input = (tokensOf(q) * pricing.inputPerMillion) / 1e6;
    min += input + (OUTPUT_TOKENS.min * pricing.outputPerMillion) / 1e6 + pricing.requestFeeMin;
    // La recherche web ajoute du contexte en entrée : marge de 3 000 jetons au maximum.
    max += input + (3000 * pricing.inputPerMillion) / 1e6 + (OUTPUT_TOKENS.max * pricing.outputPerMillion) / 1e6 + pricing.requestFeeMax;
  }
  return { queries: queries.length, minUsd: roundCents(min), maxUsd: roundCents(max), known: true };
}

export function formatUsd(value: number): string {
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}
