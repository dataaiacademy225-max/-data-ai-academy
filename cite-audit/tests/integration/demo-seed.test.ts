import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { DEMO_EMAIL, seedDemo } from "@/server/demo/seed-demo";
import { createProject } from "@/server/services/projects";
import { createUser, projectInput } from "./factories";

// Remplace l'inscription Better Auth : on teste ici l'isolation des données, pas l'authentification.
const fakeSignUp = async ({ name, email }: { name: string; email: string }) => {
  const user = await prisma.user.create({ data: { id: randomUUID(), name, email } });
  return { userId: user.id };
};

describe("seed de démonstration", () => {
  it("ne crée que des projets et audits marqués démo, sur le compte dédié", async () => {
    await seedDemo(prisma, fakeSignUp, "mot-de-passe-demo");
    const projects = await prisma.project.findMany({ include: { user: true, audits: true } });
    expect(projects.length).toBeGreaterThan(0);
    for (const project of projects) {
      expect(project.isDemo).toBe(true);
      expect(project.user.email).toBe(DEMO_EMAIL);
      expect(project.companyName).toMatch(/^\[DÉMO\]/);
      for (const audit of project.audits) expect(audit.isDemo).toBe(true);
    }
  });

  it("est rejouable sans doublon", async () => {
    await seedDemo(prisma, fakeSignUp, "mot-de-passe-demo");
    const first = await prisma.project.count();
    await seedDemo(prisma, fakeSignUp, "mot-de-passe-demo");
    expect(await prisma.project.count()).toBe(first);
    expect(await prisma.user.count({ where: { email: DEMO_EMAIL } })).toBe(1);
  });

  it("ne touche jamais aux données réelles des autres comptes", async () => {
    const real = await createUser();
    const project = await createProject(real.id, projectInput());
    await seedDemo(prisma, fakeSignUp, "mot-de-passe-demo");
    await seedDemo(prisma, fakeSignUp, "mot-de-passe-demo");
    expect(await prisma.project.findUnique({ where: { id: project.id } })).not.toBeNull();
    expect(await prisma.audit.count({ where: { isDemo: false } })).toBe(0);
  });

  it("calcule l'audit de démonstration avec le vrai moteur, textes marqués [DÉMO]", async () => {
    await seedDemo(prisma, fakeSignUp, "mot-de-passe-demo");
    const audit = await prisma.audit.findFirstOrThrow({ where: { isDemo: true, comparisonId: null }, include: { findings: true } });
    expect(audit.scoringVersion).toMatch(/^cite-/);
    expect(audit.scoreTotal).not.toBeNull();
    expect(audit.findings.length).toBeGreaterThan(0);
    for (const f of audit.findings) expect(f.observation.startsWith("[DÉMO]")).toBe(true);

    // Comparaison de démonstration : sites concurrents fictifs, notés par le vrai moteur, marqués [DÉMO].
    const comparison = await prisma.comparison.findFirstOrThrow({ include: { audits: true } });
    expect(comparison.isDemo).toBe(true);
    expect(comparison.audits.length).toBe(2);
    for (const a of comparison.audits) {
      expect(a.isDemo).toBe(true);
      expect(a.competitorName).toMatch(/^\[DÉMO\]/);
      expect(a.competitorUrl).toMatch(/example\.org/);
    }
  });

  it("crée un historique de lancements IA fictifs, tous marqués démo", async () => {
    await seedDemo(prisma, fakeSignUp, "mot-de-passe-demo");
    const runs = await prisma.aiVisibilityRun.findMany({ include: { results: true }, orderBy: { finishedAt: "asc" } });
    expect(runs.length).toBeGreaterThanOrEqual(2);
    for (const run of runs) {
      expect(run.isDemo).toBe(true);
      for (const r of run.results) expect(r.rawResponse?.startsWith("[DÉMO]")).toBe(true);
    }
    expect(new Set(runs.map((r) => r.finishedAt?.toISOString())).size).toBe(runs.length);
  });

  it("refuse de s'exécuter si le compte démo possède un projet réel", async () => {
    const demoUser = await createUser(DEMO_EMAIL);
    await createProject(demoUser.id, projectInput());
    await expect(seedDemo(prisma, fakeSignUp, "mot-de-passe-demo")).rejects.toThrow(/projets réels/);
    expect(await prisma.project.count({ where: { userId: demoUser.id } })).toBe(1);
  });

  it("crée le compte démo par Better Auth même quand les inscriptions sont sur invitation", async () => {
    const { vi } = await import("vitest");
    const { signUpDemoUser } = await import("@/server/demo/demo-sign-up");
    vi.stubEnv("SIGNUP_MODE", "invite");
    vi.stubEnv("SIGNUP_ALLOWED_EMAILS", "testeur@exemple-test.com");
    vi.stubEnv("EMAIL_TRANSPORT", "memory");
    try {
      await seedDemo(prisma, signUpDemoUser, "mot-de-passe-demo");
      expect(await prisma.user.count({ where: { email: DEMO_EMAIL } })).toBe(1);
      // L'autorisation exceptionnelle ne survit pas à l'appel.
      expect(process.env.SIGNUP_ALLOWED_EMAILS).toBe("testeur@exemple-test.com");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
