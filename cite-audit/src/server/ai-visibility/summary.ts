import type { AiProviderId } from "@/server/ai-visibility/types";

/**
 * Synthèse des échantillons de réponses d'IA, par assistant. Fonction pure.
 * Trois niveaux distincts, jamais confondus : mention, citation, recommandation.
 * Ce n'est pas un score : seulement des comptes sur les requêtes réellement analysées.
 */

export type SampleRow = {
  provider: AiProviderId;
  isDemo: boolean;
  brandMentioned: boolean | null;
  brandCited: boolean | null;
  brandRecommended: boolean | null;
};

export type ProviderSample = {
  provider: AiProviderId;
  analyzed: number;
  mentioned: number;
  cited: number;
  recommended: number;
};

export type SampleSummary = {
  /** « real » dès qu'un résultat réel existe ; sinon « demo » s'il n'y a que des données de démonstration. */
  scope: "real" | "demo" | "none";
  byProvider: Partial<Record<AiProviderId, ProviderSample>>;
};

export function summarizeAiSamples(rows: SampleRow[]): SampleSummary {
  const real = rows.filter((row) => !row.isDemo);
  const scope = real.length > 0 ? "real" : rows.length > 0 ? "demo" : "none";
  // Démonstration et réel ne sont jamais additionnés.
  const kept = scope === "real" ? real : rows;
  const byProvider: SampleSummary["byProvider"] = {};
  for (const row of kept) {
    const entry = (byProvider[row.provider] ??= {
      provider: row.provider,
      analyzed: 0,
      mentioned: 0,
      cited: 0,
      recommended: 0,
    });
    entry.analyzed += 1;
    if (row.brandMentioned) entry.mentioned += 1;
    if (row.brandCited) entry.cited += 1;
    if (row.brandRecommended) entry.recommended += 1;
  }
  return { scope, byProvider };
}
