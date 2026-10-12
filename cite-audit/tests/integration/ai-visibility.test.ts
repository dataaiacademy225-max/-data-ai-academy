import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { processAiRun } from "@/server/ai-visibility/process-run";
import { claimNextAiRun } from "@/server/ai-visibility/queue";
import { AiProviderError, type AiAnswer, type AiProvider } from "@/server/ai-visibility/types";
import { getAiModuleStatus, queriesUsedToday, requestAiRun } from "@/server/services/ai-visibility";
import { QUEUED_STALE_MS } from "@/server/services/audits";
import { createProject } from "@/server/services/projects";
import { createUser, projectInput } from "./factories";

const input = projectInput({
  companyName: "Cabinet Clair",
  siteUrl: "https://www.cabinet-clair.com/",
  domain: "www.cabinet-clair.com",
  competitors: [{ name: "Data Lagune", url: "https://datalagune.ci/" }],
});
const MODEL = "perplexity/sonar";
const launch = (userId: string, projectId: string, queries: string[], costAccepted = true) =>
  requestAiRun(userId, projectId, { providerId: "PERPLEXITY", model: MODEL, queries, costAccepted });

beforeEach(() => {
  vi.stubEnv("PERPLEXITY_API_KEY", "pplx-cle-de-test-123456");
  vi.stubEnv("AI_MAX_QUERIES_PER_RUN", "3");
  vi.stubEnv("AI_MAX_QUERIES_PER_DAY", "5");
});
afterEach(() => vi.unstubAllEnvs());

/** Fournisseur simulé : chaque requête reçoit la réponse (ou l'erreur) programmée, dans l'ordre. */
function fakeProvider(script: (AiAnswer | AiProviderError)[]): AiProvider & { asked: string[] } {
  const asked: string[] = [];
  return {
    id: "PERPLEXITY",
    label: "Perplexity (test)",
    models: [{ id: MODEL, label: "Sonar" }],
    defaultModel: MODEL,
    isConfigured: () => true,
    asked,
    async ask(query) {
      asked.push(query);
      const next = script.shift();
      if (!next) throw new Error("plus de réponse programmée");
      if (next instanceof AiProviderError) throw next;
      return next;
    },
  };
}
const answer = (text: string, sources: AiAnswer["sources"] = []): AiAnswer => ({
  model: "perplexity/sonar-2026",
  text,
  sources,
  rawPayload: { output_text: text, extra: { kept: true } },
  usage: { inputTokens: 10, outputTokens: 50 },
  costUsd: 0.006,
  latencyMs: 900,
});
const clock = () => {
  const slept: number[] = [];
  let t = 1_000_000;
  return { slept, now: () => t, sleep: async (ms: number) => void (slept.push(ms), (t += ms)) };
};

async function claimedRun(queries: string[]) {
  const user = await createUser();
  const project = await createProject(user.id, input);
  const request = await launch(user.id, project.id, queries);
  if (!request.ok) throw new Error(`échec inattendu : ${request.error}`);
  expect(await claimNextAiRun()).toBe(request.runId);
  return request.runId;
}

describe("activation du module", () => {
  it("désactivé sans clé API côté serveur", async () => {
    vi.stubEnv("PERPLEXITY_API_KEY", "");
    expect(getAiModuleStatus()).toMatchObject({ enabled: false, providers: [] });
    const user = await createUser();
    const project = await createProject(user.id, input);
    expect(await launch(user.id, project.id, ["Q1 test"])).toEqual({ ok: false, error: "MODULE_DISABLED" });
  });

  it("ne révèle jamais la clé dans l'état du module", () => {
    expect(JSON.stringify(getAiModuleStatus())).not.toContain("pplx-cle-de-test");
  });
});

describe("requestAiRun", () => {
  it("met en file une requête par ligne, avec estimation de coût et copie figée de la marque", async () => {
    const user = await createUser();
    const project = await createProject(user.id, input);
    const result = await launch(user.id, project.id, ["Quel cabinet data ?", "Meilleur consultant data"]);
    if (!result.ok) throw new Error(result.error);
    const run = await prisma.aiVisibilityRun.findUniqueOrThrow({ where: { id: result.runId }, include: { results: true } });
    expect(run).toMatchObject({ status: "QUEUED", queryCount: 2, model: MODEL, provider: "PERPLEXITY" });
    expect(run.estimatedCostMaxUsd).toBeGreaterThan(run.estimatedCostMinUsd);
    expect(run.inputSnapshot).toEqual({
      brand: { name: "Cabinet Clair", url: "https://www.cabinet-clair.com/" },
      competitors: [{ name: "Data Lagune", url: "https://datalagune.ci/" }],
    });
    expect(run.results.map((r) => [r.position, r.query, r.status])).toEqual([
      [0, "Quel cabinet data ?", "PENDING"],
      [1, "Meilleur consultant data", "PENDING"],
    ]);
  });

  it("exige l'acceptation du coût estimé", async () => {
    const user = await createUser();
    const project = await createProject(user.id, input);
    expect(await launch(user.id, project.id, ["Q1 test"], false)).toEqual({ ok: false, error: "COST_NOT_ACCEPTED" });
    expect(await prisma.aiVisibilityRun.count()).toBe(0);
  });

  it("limite le nombre de requêtes par lancement et par 24 h", async () => {
    const user = await createUser();
    const a = await createProject(user.id, input);
    const b = await createProject(user.id, input);
    expect(await launch(user.id, a.id, ["Q1 x", "Q2 x", "Q3 x", "Q4 x"])).toEqual({ ok: false, error: "TOO_MANY_QUERIES" });
    expect((await launch(user.id, a.id, ["Q1 x", "Q2 x", "Q3 x"])).ok).toBe(true);
    // 3 déjà programmées + 3 nouvelles > 5 par jour
    expect(await launch(user.id, b.id, ["Q1 x", "Q2 x", "Q3 x"])).toEqual({ ok: false, error: "DAILY_LIMIT" });
    expect((await launch(user.id, b.id, ["Q1 x", "Q2 x"])).ok).toBe(true);
  });

  it("refuse un second lancement en cours, un projet d'autrui ou de démonstration", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const project = await createProject(alice.id, input);
    expect((await launch(alice.id, project.id, ["Q1 x"])).ok).toBe(true);
    expect(await launch(alice.id, project.id, ["Q1 x"])).toEqual({ ok: false, error: "ALREADY_RUNNING" });
    expect(await launch(bob.id, project.id, ["Q1 x"])).toEqual({ ok: false, error: "NOT_FOUND" });
    const demo = await prisma.project.create({ data: { ...input, userId: alice.id, isDemo: true, ownershipAttestedAt: new Date() } });
    expect(await launch(alice.id, demo.id, ["Q1 x"])).toEqual({ ok: false, error: "DEMO_PROJECT" });
  });

  it("annule une mesure restée en attente trop longtemps (worker absent) et en accepte une nouvelle", async () => {
    const user = await createUser();
    const project = await createProject(user.id, input);
    const first = await launch(user.id, project.id, ["Q1 x", "Q2 x"]);
    if (!first.ok) throw new Error(first.error);
    expect(await launch(user.id, project.id, ["Q1 x"])).toEqual({ ok: false, error: "ALREADY_RUNNING" });

    await prisma.aiVisibilityRun.update({ where: { id: first.runId }, data: { queuedAt: new Date(Date.now() - QUEUED_STALE_MS - 1000) } });
    expect((await launch(user.id, project.id, ["Q1 x"])).ok).toBe(true);
    expect(await prisma.aiVisibilityRun.findUniqueOrThrow({ where: { id: first.runId } })).toMatchObject({ status: "CANCELED", errorCode: "QUEUE_TIMEOUT" });
  });

  it("les requêtes jamais envoyées d'une mesure annulée ne consomment pas le quota", async () => {
    const user = await createUser();
    const project = await createProject(user.id, input);
    const run = await launch(user.id, project.id, ["Q1 x", "Q2 x", "Q3 x"]);
    if (!run.ok) throw new Error(run.error);
    expect(await queriesUsedToday(user.id)).toBe(3);
    await prisma.aiVisibilityRun.update({ where: { id: run.runId }, data: { status: "CANCELED" } });
    expect(await queriesUsedToday(user.id)).toBe(0);
  });

  it("des demandes simultanées ne créent qu'une seule mesure", async () => {
    const user = await createUser();
    const project = await createProject(user.id, input);
    const results = await Promise.all(Array.from({ length: 20 }, () => launch(user.id, project.id, ["Q1 x"])));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await prisma.aiVisibilityRun.count({ where: { projectId: project.id } })).toBe(1);
  });

  it("refuse un modèle non proposé", async () => {
    const user = await createUser();
    const project = await createProject(user.id, input);
    expect(await requestAiRun(user.id, project.id, { providerId: "PERPLEXITY", model: "gpt-x", queries: ["Q1 x"], costAccepted: true })).toEqual({
      ok: false,
      error: "UNKNOWN_MODEL",
    });
  });
});

describe("processAiRun", () => {
  it("enregistre requête, modèle, date, réponse brute intacte, sources, mention/citation/recommandation et concurrents", async () => {
    const runId = await claimedRun(["Quel cabinet data choisir à Abidjan ?"]);
    const text = "  Je vous recommande Cabinet Clair.\nData Lagune est aussi présent. **Source** : https://datalagune.ci/etude  ";
    const provider = fakeProvider([answer(text, [{ url: "https://www.cabinet-clair.com/offres", origin: "API" }])]);
    await processAiRun(runId, { provider, clock: clock(), minIntervalMs: 0 });

    const run = await prisma.aiVisibilityRun.findUniqueOrThrow({ where: { id: runId }, include: { results: true } });
    expect(run).toMatchObject({ status: "SUCCEEDED", actualCostUsd: 0.006 });
    const r = run.results[0];
    expect(provider.asked).toEqual(["Quel cabinet data choisir à Abidjan ?"]);
    expect(r).toMatchObject({
      status: "SUCCEEDED",
      query: "Quel cabinet data choisir à Abidjan ?",
      provider: "PERPLEXITY",
      requestedModel: MODEL,
      model: "perplexity/sonar-2026",
      rawResponse: text, // identique, espaces compris
      brandMentioned: true,
      brandCited: true,
      brandRecommended: true,
      attempts: 1,
    });
    expect(r.askedAt).toBeInstanceOf(Date);
    expect(r.rawPayload).toEqual({ output_text: text, extra: { kept: true } });
    expect(r.sources).toEqual([
      { url: "https://www.cabinet-clair.com/offres", origin: "API" },
      { url: "https://datalagune.ci/etude", origin: "TEXT" },
    ]);
    expect(r.competitorsMentioned).toEqual([expect.objectContaining({ name: "Data Lagune", mentioned: true, cited: true, recommended: false })]);
  });

  it("limite de débit : attend le délai demandé puis réessaie", async () => {
    const runId = await claimedRun(["Q1 test"]);
    const c = clock();
    const provider = fakeProvider([new AiProviderError("RATE_LIMITED", "429", true, 429, 7000), answer("Réponse sans la marque.")]);
    await processAiRun(runId, { provider, clock: c, minIntervalMs: 0 });
    expect(c.slept).toContain(7000);
    const r = await prisma.aiQueryResult.findFirstOrThrow({ where: { runId } });
    expect(r).toMatchObject({ status: "SUCCEEDED", attempts: 2, brandMentioned: false, brandRecommended: false });
  });

  it("erreur persistante : 3 essais puis échec enregistré, les autres requêtes continuent", async () => {
    const runId = await claimedRun(["Q1 test", "Q2 test"]);
    const err = () => new AiProviderError("SERVER", "Erreur du fournisseur (HTTP 503).", true, 503);
    const provider = fakeProvider([err(), err(), err(), answer("Cabinet Clair est cité.")]);
    await processAiRun(runId, { provider, clock: clock(), minIntervalMs: 0 });
    const results = await prisma.aiQueryResult.findMany({ where: { runId }, orderBy: { position: "asc" } });
    expect(results[0]).toMatchObject({ status: "FAILED", attempts: 3, errorCode: "SERVER", httpStatus: 503, rawResponse: null });
    expect(results[1]).toMatchObject({ status: "SUCCEEDED", brandMentioned: true });
    expect(await prisma.aiVisibilityRun.findUniqueOrThrow({ where: { id: runId } })).toMatchObject({ status: "PARTIAL" });
  });

  it("clé refusée : arrêt immédiat, aucune autre requête envoyée", async () => {
    const runId = await claimedRun(["Q1 test", "Q2 test", "Q3 test"]);
    const provider = fakeProvider([new AiProviderError("AUTH", "Clé refusée (HTTP 401).", false, 401)]);
    await processAiRun(runId, { provider, clock: clock(), minIntervalMs: 0 });
    expect(provider.asked).toHaveLength(1);
    const results = await prisma.aiQueryResult.findMany({ where: { runId } });
    expect(results.every((r) => r.status === "FAILED" && r.errorCode === "AUTH")).toBe(true);
    expect(await prisma.aiVisibilityRun.findUniqueOrThrow({ where: { id: runId } })).toMatchObject({ status: "FAILED", errorCode: "ALL_QUERIES_FAILED" });
  });

  it("reprise après arrêt : seules les requêtes en attente sont envoyées (pas de double facturation)", async () => {
    const runId = await claimedRun(["Q1 test", "Q2 test"]);
    // Le premier worker a traité Q1 puis s'est arrêté.
    await prisma.aiQueryResult.updateMany({ where: { runId, position: 0 }, data: { status: "SUCCEEDED", rawResponse: "déjà répondu", attempts: 1 } });
    await prisma.aiVisibilityRun.update({ where: { id: runId }, data: { lockedAt: new Date(Date.now() - 60 * 60_000) } });
    expect(await claimNextAiRun()).toBe(runId);

    const provider = fakeProvider([answer("Réponse Q2.")]);
    await processAiRun(runId, { provider, clock: clock(), minIntervalMs: 0 });
    expect(provider.asked).toEqual(["Q2 test"]);
    const first = await prisma.aiQueryResult.findFirstOrThrow({ where: { runId, position: 0 } });
    expect(first.rawResponse).toBe("déjà répondu");
    expect(await prisma.aiVisibilityRun.findUniqueOrThrow({ where: { id: runId } })).toMatchObject({ status: "SUCCEEDED", attempts: 2 });
  });

  it("projet supprimé pendant la mesure : aucune exception (le worker continue)", async () => {
    const runId = await claimedRun(["Q1 test", "Q2 test"]);
    const run = await prisma.aiVisibilityRun.findUniqueOrThrow({ where: { id: runId } });
    const provider = fakeProvider([answer("a"), answer("b")]);
    const ask = provider.ask.bind(provider);
    provider.ask = async (q, o) => {
      await prisma.project.delete({ where: { id: run.projectId } });
      return ask(q, o);
    };
    await expect(processAiRun(runId, { provider, clock: clock(), minIntervalMs: 0 })).resolves.toBeUndefined();
    expect(await prisma.aiVisibilityRun.count({ where: { id: runId } })).toBe(0);
  });

  it("espace les appels selon l'intervalle minimal", async () => {
    const runId = await claimedRun(["Q1 test", "Q2 test", "Q3 test"]);
    const c = clock();
    await processAiRun(runId, { provider: fakeProvider([answer("a"), answer("b"), answer("c")]), clock: c, minIntervalMs: 1500 });
    expect(c.slept).toEqual([1500, 1500]);
  });

  it("ne prend jamais un lancement de démonstration", async () => {
    const user = await createUser();
    const demo = await prisma.project.create({ data: { ...input, userId: user.id, isDemo: true, ownershipAttestedAt: new Date() } });
    await prisma.aiVisibilityRun.create({
      data: { projectId: demo.id, isDemo: true, provider: "PERPLEXITY", model: MODEL, queryCount: 0, estimatedCostMinUsd: 0, estimatedCostMaxUsd: 0, inputSnapshot: {} },
    });
    expect(await claimNextAiRun()).toBeNull();
  });
});
