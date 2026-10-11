import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { claimNextAudit, MAX_ATTEMPTS, reportProgress } from "@/server/jobs/queue";
import { createProject } from "@/server/services/projects";
import { createUser, projectInput } from "./factories";

async function queued(isDemo = false, minutesAgo = 0) {
  const user = await createUser();
  const project = isDemo
    ? await prisma.project.create({ data: { ...projectInput(), userId: user.id, isDemo: true, ownershipAttestedAt: new Date() } })
    : await createProject(user.id, projectInput());
  return prisma.audit.create({
    data: { projectId: project.id, isDemo, status: "QUEUED", scoringVersion: "cite-1.0.0", inputSnapshot: {}, queuedAt: new Date(Date.now() - minutesAgo * 60_000) },
  });
}

describe("file d'attente", () => {
  it("prend le plus ancien audit en attente et le passe en cours", async () => {
    const recent = await queued(false, 1);
    const oldest = await queued(false, 5);
    expect(await claimNextAudit()).toBe(oldest.id);
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: oldest.id } })).toMatchObject({ status: "RUNNING", attempts: 1 });
    expect(await claimNextAudit()).toBe(recent.id);
    expect(await claimNextAudit()).toBeNull();
  });

  it("deux workers simultanés ne prennent jamais le même audit", async () => {
    await queued();
    await queued();
    const claims = await Promise.all(Array.from({ length: 6 }, () => claimNextAudit()));
    const taken = claims.filter(Boolean);
    expect(taken).toHaveLength(2);
    expect(new Set(taken).size).toBe(2);
  });

  it("ne prend jamais un audit de démonstration", async () => {
    await queued(true);
    expect(await claimNextAudit()).toBeNull();
  });

  it("reprend un audit abandonné par un worker arrêté", async () => {
    const audit = await queued();
    expect(await claimNextAudit()).toBe(audit.id);
    await prisma.audit.update({ where: { id: audit.id }, data: { lockedAt: new Date(Date.now() - 60 * 60_000) } });
    expect(await claimNextAudit()).toBe(audit.id);
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).attempts).toBe(2);
  });

  it("ne reprend pas un audit dont le worker donne signe de vie", async () => {
    const audit = await queued();
    await claimNextAudit();
    await reportProgress(audit.id, { phase: "pages", pagesDone: 3, pagesTotal: 10 });
    expect(await claimNextAudit()).toBeNull();
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).progress).toEqual({ phase: "pages", pagesDone: 3, pagesTotal: 10 });
  });

  it(`marque en échec après ${MAX_ATTEMPTS} tentatives abandonnées`, async () => {
    const audit = await queued();
    await prisma.audit.update({ where: { id: audit.id }, data: { status: "RUNNING", attempts: MAX_ATTEMPTS, lockedAt: new Date(Date.now() - 60 * 60_000) } });
    expect(await claimNextAudit()).toBeNull();
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: "FAILED", errorCode: "TOO_MANY_ATTEMPTS" });
  });
});
