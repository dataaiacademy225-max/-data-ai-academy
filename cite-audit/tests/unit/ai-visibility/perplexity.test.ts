import { describe, expect, it } from "vitest";
import { createPerplexityProvider, parseRetryAfter, readSources, readText, readUsage } from "@/server/ai-visibility/providers/perplexity";
import { AiProviderError } from "@/server/ai-visibility/types";

const KEY = "pplx-test-secret-key-123456";

/** Réponses au format Agent API (/v1/responses) et chat/completions, d'après les formats publiés. */
const AGENT_PAYLOAD = {
  id: "resp_1",
  model: "perplexity/sonar",
  output: [
    { type: "search_results", results: [{ title: "Cabinet Clair", url: "https://cabinet-clair.com/", date: "2026-09-01" }] },
    {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "Cabinet Clair accompagne les PME [1].", annotations: [{ type: "url_citation", url: "https://datalagune.ci/", title: "Data Lagune" }] }],
    },
  ],
  usage: { input_tokens: 12, output_tokens: 80, total_tokens: 92, cost: { total_cost: 0.0061 } },
};
const CHAT_PAYLOAD = {
  model: "sonar",
  choices: [{ message: { role: "assistant", content: "Réponse chat." } }],
  citations: ["https://a.com/", "https://b.com/"],
  search_results: [{ title: "B", url: "https://b.com/" }],
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
};

function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: URL | string, init?: RequestInit) => {
    calls.push({ url: url.toString(), init: init! });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
  }) as typeof fetch;
  return { impl, calls };
}

const provider = (impl: typeof fetch, mode: "agent" | "chat" = "agent", apiKey: string | null = KEY) =>
  createPerplexityProvider({ apiKey: apiKey ?? undefined, mode, baseUrl: "https://api.perplexity.ai", fetchImpl: impl, timeoutMs: 200 });

describe("lecture des formats de réponse", () => {
  it("Agent API : texte, sources (résultats + annotations), usage et coût", () => {
    expect(readText(AGENT_PAYLOAD)).toBe("Cabinet Clair accompagne les PME [1].");
    expect(readSources(AGENT_PAYLOAD).map((s) => s.url)).toEqual(["https://cabinet-clair.com/", "https://datalagune.ci/"]);
    expect(readUsage(AGENT_PAYLOAD)).toEqual({ usage: { inputTokens: 12, outputTokens: 80, totalTokens: 92 }, costUsd: 0.0061 });
  });

  it("chat/completions : texte, citations dédoublonnées", () => {
    expect(readText(CHAT_PAYLOAD)).toBe("Réponse chat.");
    expect(readSources(CHAT_PAYLOAD)).toEqual([
      { url: "https://a.com/", title: undefined, origin: "API" },
      { url: "https://b.com/", title: undefined, origin: "API" },
    ]);
    expect(readUsage(CHAT_PAYLOAD).costUsd).toBeNull();
  });

  it("ignore les sources non http(s)", () => {
    expect(readSources({ citations: ["javascript:alert(1)", "ftp://x", 42] })).toEqual([]);
  });
});

describe("appel au fournisseur", () => {
  it("n'est pas configuré sans clé et refuse alors tout appel", async () => {
    const { impl, calls } = fakeFetch(200, AGENT_PAYLOAD);
    const p = provider(impl, "agent", null);
    expect(p.isConfigured()).toBe(false);
    await expect(p.ask("Q", { model: "perplexity/sonar" })).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(calls).toHaveLength(0);
  });

  it("Agent API : envoie la requête telle quelle, sans consigne cachée, et garde la réponse complète", async () => {
    const { impl, calls } = fakeFetch(200, AGENT_PAYLOAD);
    const answer = await provider(impl).ask("Quel cabinet data à Abidjan ?", { model: "perplexity/sonar" });
    expect(calls[0].url).toBe("https://api.perplexity.ai/v1/responses");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ model: "perplexity/sonar", input: "Quel cabinet data à Abidjan ?", tools: [{ type: "web_search" }] });
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`);
    expect(answer).toMatchObject({ model: "perplexity/sonar", text: "Cabinet Clair accompagne les PME [1].", costUsd: 0.0061 });
    expect(answer.rawPayload).toEqual(AGENT_PAYLOAD);
  });

  it("mode chat : ancien endpoint", async () => {
    const { impl, calls } = fakeFetch(200, CHAT_PAYLOAD);
    await provider(impl, "chat").ask("Q", { model: "sonar" });
    expect(calls[0].url).toBe("https://api.perplexity.ai/chat/completions");
  });

  it("refuse un modèle non pris en charge sans appel réseau", async () => {
    const { impl, calls } = fakeFetch(200, AGENT_PAYLOAD);
    await expect(provider(impl).ask("Q", { model: "sonar-pro" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(calls).toHaveLength(0);
  });

  it.each([
    [429, { "retry-after": "7" }, "RATE_LIMITED", true, 7000],
    [503, {}, "SERVER", true, undefined],
    [401, {}, "AUTH", false, undefined],
    [403, {}, "AUTH", false, undefined],
    [400, {}, "BAD_REQUEST", false, undefined],
  ])("HTTP %i → %s", async (status, headers, code, retryable, retryAfterMs) => {
    const { impl } = fakeFetch(status, { error: { message: `erreur avec la clé ${KEY}` } }, headers as Record<string, string>);
    const err = (await provider(impl).ask("Q", { model: "perplexity/sonar" }).catch((e) => e)) as AiProviderError;
    expect(err).toBeInstanceOf(AiProviderError);
    expect(err).toMatchObject({ code, retryable, httpStatus: status, retryAfterMs });
    // La clé n'apparaît jamais dans un message d'erreur.
    expect(err.message).not.toContain(KEY);
  });

  it("réponse illisible ou sans texte → INVALID_RESPONSE", async () => {
    await expect(provider(fakeFetch(200, "<html>oops</html>").impl).ask("Q", { model: "perplexity/sonar" })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(provider(fakeFetch(200, { output: [] }).impl).ask("Q", { model: "perplexity/sonar" })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("délai dépassé → TIMEOUT (réessayable)", async () => {
    const hang = ((_u: unknown, init?: RequestInit) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("timeout"), { name: "TimeoutError" }))))) as typeof fetch;
    await expect(provider(hang).ask("Q", { model: "perplexity/sonar" })).rejects.toMatchObject({ code: "TIMEOUT", retryable: true });
  });

  it("erreur réseau → NETWORK (réessayable)", async () => {
    const broken = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(provider(broken).ask("Q", { model: "perplexity/sonar" })).rejects.toMatchObject({ code: "NETWORK", retryable: true });
  });
});

describe("parseRetryAfter", () => {
  it("lit des secondes ou une date, plafonne à 2 minutes", () => {
    expect(parseRetryAfter("3")).toBe(3000);
    expect(parseRetryAfter("9999")).toBe(120_000);
    expect(parseRetryAfter(new Date(1_000_000 + 5000).toUTCString(), 1_000_000)).toBe(5000);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("n'importe quoi")).toBeUndefined();
  });
});
