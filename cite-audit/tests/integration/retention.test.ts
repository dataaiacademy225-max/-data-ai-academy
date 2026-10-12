import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createProject } from "@/server/services/projects";
import { purgeExpiredData } from "@/server/services/retention";
import { createUser, projectInput } from "./factories";

const now = new Date("2026-10-12T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const config = { AUDIT_RETENTION_DAYS: 730, AI_RUN_RETENTION_DAYS: 365 };

async function audit(projectId: string, queuedAt: Date, status: "SUCCEEDED" | "RUNNING" = "SUCCEEDED", isDemo = false) {
  const a = await prisma.audit.create({ data: { projectId, isDemo, queuedAt, status, scoringVersion: "test", inputSnapshot: {} } });
  await prisma.pageAnalysis.create({ data: { auditId: a.id, requestedUrl: "https://example.org/", robotsAllowed: true } });
  return a.id;
}

async function aiRun(projectId: string, queuedAt: Date) {
  const r = await prisma.aiVisibilityRun.create({
    data: {
      projectId,
      queuedAt,
      status: "SUCCEEDED",
      provider: "PERPLEXITY",
      model: "perplexity/sonar",
      queryCount: 1,
      estimatedCostMinUsd: 0,
      estimatedCostMaxUsd: 0.01,
      inputSnapshot: {},
      results: { create: [{ position: 0, query: "q", provider: "PERPLEXITY", requestedModel: "perplexity/sonar" }] },
    },
  });
  return r.id;
}

const remainingAudits = async () => (await prisma.audit.findMany({ select: { id: true } })).map((a) => a.id).sort();

describe("purge des données expirées", () => {
  it("supprime les vieux audits mais garde toujours le plus récent de chaque projet", async () => {
    const user = await createUser();
    const p1 = await createProject(user.id, projectInput());
    const p2 = await createProject(user.id, projectInput({ companyName: "Projet 2" }));
    await audit(p1.id, daysAgo(900));
    const recent1 = await audit(p1.id, daysAgo(10));
    const onlyOld2 = await audit(p2.id, daysAgo(1000));
    await audit(p2.id, daysAgo(1200));

    const report = await purgeExpiredData(config, now);

    expect(report.audits).toBe(2);
    expect(await remainingAudits()).toEqual([recent1, onlyOld2].sort());
    // Les pages analysées des audits supprimés partent en cascade.
    expect(await prisma.pageAnalysis.count()).toBe(2);
  });

  it("ne touche ni aux audits en cours ni aux données de démonstration", async () => {
    const user = await createUser();
    const real = await createProject(user.id, projectInput());
    const demo = await prisma.project.create({
      data: { ...projectInput({ companyName: "[DÉMO] P" }), userId: user.id, isDemo: true, ownershipAttestedAt: now },
    });
    const running = await audit(real.id, daysAgo(900), "RUNNING");
    await audit(real.id, daysAgo(1));
    const demoOld = await audit(demo.id, daysAgo(900), "SUCCEEDED", true);
    await audit(demo.id, daysAgo(1), "SUCCEEDED", true);

    await purgeExpiredData(config, now);
    const ids = await remainingAudits();
    expect(ids).toContain(running);
    expect(ids).toContain(demoOld);
  });

  it("supprime les vieilles mesures IA (réponses comprises), sauf la plus récente du projet", async () => {
    const user = await createUser();
    const project = await createProject(user.id, projectInput());
    await aiRun(project.id, daysAgo(500));
    const kept = await aiRun(project.id, daysAgo(400));

    expect((await purgeExpiredData(config, now)).aiRuns).toBe(1);
    expect((await prisma.aiVisibilityRun.findMany()).map((r) => r.id)).toEqual([kept]);
    expect(await prisma.aiQueryResult.count()).toBe(1);
  });

  it("0 jour désactive la purge des audits et des mesures IA", async () => {
    const user = await createUser();
    const project = await createProject(user.id, projectInput());
    await audit(project.id, daysAgo(5000));
    await audit(project.id, daysAgo(1));
    await aiRun(project.id, daysAgo(5000));
    await aiRun(project.id, daysAgo(1));
    const report = await purgeExpiredData({ AUDIT_RETENTION_DAYS: 0, AI_RUN_RETENTION_DAYS: 0 }, now);
    expect(report).toMatchObject({ audits: 0, aiRuns: 0 });
  });

  it("supprime les sessions et jetons de vérification expirés uniquement", async () => {
    const user = await createUser();
    for (const expiresAt of [daysAgo(1), daysAgo(-1)]) {
      await prisma.session.create({ data: { id: randomUUID(), token: randomUUID(), userId: user.id, expiresAt } });
      await prisma.verification.create({ data: { id: randomUUID(), identifier: "x", value: "y", expiresAt } });
    }
    const report = await purgeExpiredData(config, now);
    expect(report).toMatchObject({ sessions: 1, verifications: 1 });
    expect(await prisma.session.count()).toBe(1);
    expect(await prisma.verification.count()).toBe(1);
  });
});
