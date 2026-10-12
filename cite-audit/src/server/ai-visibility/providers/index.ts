import "server-only";
import { getAiEnv } from "@/lib/env";
import { createPerplexityProvider } from "@/server/ai-visibility/providers/perplexity";
import type { AiProvider, AiProviderId } from "@/server/ai-visibility/types";

/**
 * Registre des fournisseurs. Ajouter un fournisseur = écrire un adaptateur AiProvider et l'ajouter ici.
 * Seuls les fournisseurs dont la clé est configurée côté serveur sont proposés.
 */
export function getProviders(): AiProvider[] {
  const env = getAiEnv();
  return [createPerplexityProvider({ apiKey: env.PERPLEXITY_API_KEY, mode: env.PERPLEXITY_API_MODE, baseUrl: env.PERPLEXITY_BASE_URL })];
}

export function getConfiguredProviders(): AiProvider[] {
  return getProviders().filter((p) => p.isConfigured());
}

export function getProvider(id: AiProviderId): AiProvider | null {
  return getConfiguredProviders().find((p) => p.id === id) ?? null;
}

/** Description publique (sans secret) des fournisseurs disponibles, pour l'interface. */
export function describeProviders() {
  return getConfiguredProviders().map((p) => ({ id: p.id, label: p.label, models: p.models, defaultModel: p.defaultModel }));
}
