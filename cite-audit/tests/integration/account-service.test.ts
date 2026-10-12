import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { deleteAccount } from "@/server/services/account";
import { createProject } from "@/server/services/projects";
import { createUser, projectInput } from "./factories";

const PASSWORD = "mot-de-passe-solide";

async function userWithPassword() {
  const user = await createUser();
  await prisma.account.create({
    data: { id: randomUUID(), accountId: user.id, providerId: "credential", userId: user.id, password: await hashPassword(PASSWORD) },
  });
  await prisma.session.create({
    data: { id: randomUUID(), token: randomUUID(), userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  return user;
}

async function addAuditAndAiRun(projectId: string) {
  const audit = await prisma.audit.create({ data: { projectId, scoringVersion: "test", inputSnapshot: {} } });
  await prisma.pageAnalysis.create({ data: { auditId: audit.id, requestedUrl: "https://example.org/", robotsAllowed: true } });
  await prisma.aiVisibilityRun.create({
    data: {
      projectId,
      provider: "PERPLEXITY",
      model: "perplexity/sonar",
      queryCount: 1,
      estimatedCostMinUsd: 0,
      estimatedCostMaxUsd: 0.01,
      inputSnapshot: {},
      results: { create: [{ position: 0, query: "q", provider: "PERPLEXITY", requestedModel: "perplexity/sonar" }] },
    },
  });
}

describe("suppression de compte", () => {
  it("supprime le compte et toutes ses données, sans toucher aux autres utilisateurs", async () => {
    const alice = await userWithPassword();
    const bob = await userWithPassword();
    for (const user of [alice, bob]) {
      const project = await createProject(user.id, projectInput());
      await addAuditAndAiRun(project.id);
    }

    expect(await deleteAccount(alice.id, PASSWORD, verifyPassword)).toEqual({ ok: true });

    expect(await prisma.user.findUnique({ where: { id: alice.id } })).toBeNull();
    expect(await prisma.session.count({ where: { userId: alice.id } })).toBe(0);
    expect(await prisma.account.count({ where: { userId: alice.id } })).toBe(0);
    expect(await prisma.project.count({ where: { userId: alice.id } })).toBe(0);
    // Il ne reste que les données de Bob.
    expect(await prisma.audit.count()).toBe(1);
    expect(await prisma.pageAnalysis.count()).toBe(1);
    expect(await prisma.aiVisibilityRun.count()).toBe(1);
    expect(await prisma.aiQueryResult.count()).toBe(1);
    expect(await prisma.session.count({ where: { userId: bob.id } })).toBe(1);
  });

  it("refuse un mot de passe incorrect et ne supprime rien", async () => {
    const user = await userWithPassword();
    await createProject(user.id, projectInput());
    expect(await deleteAccount(user.id, "mauvais-mot-de-passe", verifyPassword)).toEqual({ ok: false, error: "WRONG_PASSWORD" });
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);
    expect(await prisma.project.count({ where: { userId: user.id } })).toBe(1);
  });

  it("refuse le compte de démonstration", async () => {
    const user = await userWithPassword();
    await prisma.project.create({
      data: { ...projectInput({ companyName: "[DÉMO] Projet" }), userId: user.id, isDemo: true, ownershipAttestedAt: new Date() },
    });
    expect(await deleteAccount(user.id, PASSWORD, verifyPassword)).toEqual({ ok: false, error: "DEMO_ACCOUNT" });
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);
  });

  it("renvoie introuvable pour un compte sans mot de passe ou inexistant", async () => {
    const user = await createUser();
    expect(await deleteAccount(user.id, PASSWORD, verifyPassword)).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(await deleteAccount("inconnu", PASSWORD, verifyPassword)).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});
