/**
 * Module facultatif de mesure de visibilité IA.
 * Interface abstraite AiProvider : Perplexity aujourd'hui, d'autres fournisseurs plus tard.
 */

export type AiProviderId = "PERPLEXITY" | "OPENAI_COMPATIBLE" | "ANTHROPIC" | "GEMINI";

/** Source renvoyée par l'IA. `origin` dit d'où elle vient : jamais déduite ni inventée. */
export type AiSource = {
  url: string;
  title?: string;
  /** API : champ structuré de la réponse (citations, résultats de recherche). TEXT : adresse écrite dans le texte. */
  origin: "API" | "TEXT";
};

export type AiUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };

export type AiAnswer = {
  /** Identifiant du modèle tel que renvoyé par l'API (pas celui supposé). */
  model: string;
  /** Texte de la réponse, exactement tel que reçu. */
  text: string;
  /** Sources présentes dans les champs structurés de la réponse. */
  sources: AiSource[];
  /** Réponse JSON complète, non modifiée. */
  rawPayload: unknown;
  usage: AiUsage | null;
  /** Coût réel si l'API le communique, sinon null. */
  costUsd: number | null;
  latencyMs: number;
};

export type AiErrorCode =
  | "NOT_CONFIGURED"
  | "AUTH" // clé refusée
  | "RATE_LIMITED" // 429
  | "BAD_REQUEST" // requête refusée (modèle, paramètres)
  | "SERVER" // 5xx
  | "TIMEOUT"
  | "NETWORK"
  | "INVALID_RESPONSE"; // réponse illisible ou sans texte

export class AiProviderError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly httpStatus?: number,
    /** Délai demandé par le fournisseur avant de réessayer (en-tête Retry-After). */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export type AiModel = { id: string; label: string };

export interface AiProvider {
  readonly id: AiProviderId;
  readonly label: string;
  readonly models: AiModel[];
  readonly defaultModel: string;
  /** Vrai seulement si une clé API est configurée côté serveur. */
  isConfigured(): boolean;
  /** Envoie une requête et renvoie la réponse brute + sa lecture. Lève AiProviderError en cas d'échec. */
  ask(query: string, options: { model: string; signal?: AbortSignal }): Promise<AiAnswer>;
}
