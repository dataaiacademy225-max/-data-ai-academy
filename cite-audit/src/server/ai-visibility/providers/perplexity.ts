import { AiProviderError, type AiAnswer, type AiProvider, type AiSource, type AiUsage } from "@/server/ai-visibility/types";

/**
 * Adaptateur Perplexity.
 * - mode « agent » (défaut) : Agent API, POST /v1/responses, modèle « perplexity/sonar » ;
 * - mode « chat » : ancien format POST /chat/completions (support officiel arrêté le 27/09/2026).
 * La lecture de la réponse est défensive : plusieurs formats sont acceptés et le JSON complet
 * est toujours conservé tel quel (rawPayload) pour vérification.
 */

export type PerplexityConfig = {
  apiKey: string | undefined;
  mode: "agent" | "chat";
  baseUrl: string;
  timeoutMs?: number;
  /** Remplaçable dans les tests : aucun appel réseau réel. */
  fetchImpl?: typeof fetch;
};

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Délai Retry-After (secondes ou date HTTP), plafonné à 2 minutes. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now;
  return Number.isFinite(ms) && ms >= 0 ? Math.min(ms, 120_000) : undefined;
}

/** Texte de la réponse, quel que soit le format (Agent API ou chat/completions). */
export function readText(payload: Json): string | null {
  const direct = str(payload.output_text);
  if (direct) return direct;
  if (Array.isArray(payload.output)) {
    const parts: string[] = [];
    for (const item of payload.output) {
      if (!isObject(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
      for (const c of item.content) if (isObject(c) && (c.type === "output_text" || c.type === "text") && str(c.text)) parts.push(c.text as string);
    }
    if (parts.length) return parts.join("\n\n");
  }
  if (Array.isArray(payload.choices) && isObject(payload.choices[0]) && isObject(payload.choices[0].message)) {
    return str(payload.choices[0].message.content) ?? null;
  }
  return null;
}

/** Sources présentes dans les champs structurés. Aucune n'est déduite du texte ici. */
export function readSources(payload: Json): AiSource[] {
  const found = new Map<string, AiSource>();
  const add = (url: unknown, title?: unknown) => {
    const u = str(url);
    if (!u || !/^https?:\/\//i.test(u) || found.has(u)) return;
    found.set(u, { url: u, title: str(title), origin: "API" });
  };
  const fromResults = (results: unknown) => {
    if (Array.isArray(results)) for (const r of results) if (isObject(r)) add(r.url, r.title);
  };
  if (Array.isArray(payload.citations)) for (const c of payload.citations) add(isObject(c) ? c.url : c, isObject(c) ? c.title : undefined);
  fromResults(payload.search_results);
  if (Array.isArray(payload.output)) {
    for (const item of payload.output) {
      if (!isObject(item)) continue;
      if (item.type === "search_results") fromResults(item.results ?? item.search_results);
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (isObject(c) && Array.isArray(c.annotations)) for (const a of c.annotations) if (isObject(a)) add(a.url, a.title);
        }
      }
    }
  }
  return [...found.values()];
}

export function readUsage(payload: Json): { usage: AiUsage | null; costUsd: number | null } {
  const u = payload.usage;
  if (!isObject(u)) return { usage: null, costUsd: null };
  const cost = u.cost;
  const costUsd = num(cost) ?? (isObject(cost) ? (num(cost.total_cost) ?? num(cost.total)) : undefined) ?? null;
  return {
    usage: {
      inputTokens: num(u.input_tokens) ?? num(u.prompt_tokens),
      outputTokens: num(u.output_tokens) ?? num(u.completion_tokens),
      totalTokens: num(u.total_tokens),
    },
    costUsd,
  };
}

function errorFor(status: number, retryAfterMs: number | undefined, detail: string): AiProviderError {
  if (status === 401 || status === 403) return new AiProviderError("AUTH", `Clé refusée ou accès interdit (HTTP ${status}).${detail}`, false, status);
  if (status === 429) return new AiProviderError("RATE_LIMITED", "Limite de requêtes du fournisseur atteinte (HTTP 429).", true, status, retryAfterMs);
  if (status >= 500) return new AiProviderError("SERVER", `Erreur du fournisseur (HTTP ${status}).`, true, status, retryAfterMs);
  return new AiProviderError("BAD_REQUEST", `Requête refusée par le fournisseur (HTTP ${status}).${detail}`, false, status);
}

/** Message d'erreur du fournisseur, court et nettoyé (jamais la clé, jamais d'en-tête). */
function providerDetail(body: string, apiKey: string): string {
  let message: string | undefined;
  try {
    const parsed = JSON.parse(body) as Json;
    const e = parsed.error;
    message = isObject(e) ? (str(e.message) ?? str(e.type)) : (str(e) ?? str(parsed.message) ?? str(parsed.detail));
  } catch {
    // corps non JSON : ignoré
  }
  if (!message) return "";
  return ` Détail : ${message.replaceAll(apiKey, "[clé]").replace(/\s+/g, " ").slice(0, 200)}`;
}

export function createPerplexityProvider(config: PerplexityConfig): AiProvider {
  const doFetch = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 60_000;
  const models =
    config.mode === "agent"
      ? [{ id: "perplexity/sonar", label: "Perplexity Sonar (Agent API)" }]
      : [
          { id: "sonar", label: "Perplexity Sonar" },
          { id: "sonar-pro", label: "Perplexity Sonar Pro" },
        ];

  return {
    id: "PERPLEXITY",
    label: "Perplexity",
    models,
    defaultModel: models[0].id,
    isConfigured: () => Boolean(config.apiKey),

    async ask(query, { model, signal }): Promise<AiAnswer> {
      const apiKey = config.apiKey;
      if (!apiKey) throw new AiProviderError("NOT_CONFIGURED", "Aucune clé Perplexity n'est configurée côté serveur.", false);
      if (!models.some((m) => m.id === model)) throw new AiProviderError("BAD_REQUEST", `Modèle non pris en charge : ${model}.`, false);

      // La requête est envoyée telle que saisie : aucune consigne cachée qui orienterait la réponse vers la marque.
      const [path, body] =
        config.mode === "agent"
          ? ["/v1/responses", { model, input: query, tools: [{ type: "web_search" }] }]
          : ["/chat/completions", { model, messages: [{ role: "user", content: query }] }];

      const timeout = AbortSignal.timeout(timeoutMs);
      const started = Date.now();
      let response: Response;
      try {
        response = await doFetch(new URL(path, config.baseUrl), {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body),
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch (error) {
        if (timeout.aborted || (error as Error)?.name === "TimeoutError") {
          throw new AiProviderError("TIMEOUT", "Le fournisseur n'a pas répondu à temps.", true);
        }
        throw new AiProviderError("NETWORK", "Connexion au fournisseur impossible.", true);
      }

      const text = await response.text();
      if (text.length > MAX_RESPONSE_BYTES) throw new AiProviderError("INVALID_RESPONSE", "Réponse du fournisseur trop volumineuse.", false, response.status);
      if (!response.ok) {
        throw errorFor(response.status, parseRetryAfter(response.headers.get("retry-after")), providerDetail(text, apiKey));
      }

      let payload: Json;
      try {
        const parsed: unknown = JSON.parse(text);
        if (!isObject(parsed)) throw new Error("not an object");
        payload = parsed;
      } catch {
        throw new AiProviderError("INVALID_RESPONSE", "Réponse du fournisseur illisible (JSON invalide).", false, response.status);
      }
      const answer = readText(payload);
      if (answer === null) throw new AiProviderError("INVALID_RESPONSE", "Réponse du fournisseur sans texte exploitable.", false, response.status);

      const { usage, costUsd } = readUsage(payload);
      return {
        model: str(payload.model) ?? model,
        text: answer,
        sources: readSources(payload),
        rawPayload: payload,
        usage,
        costUsd,
        latencyMs: Date.now() - started,
      };
    },
  };
}
