import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getAuditReport, listAudits, MAX_AUDITS_PER_DAY, QUEUED_STALE_MS, requestAudit } from "@/server/services/audits";
import { createProject } from "@/server/services/projects";
import { createUser, projectInput } from "./factories";

describe("requestAudit", () => {
  it("place l'audit en file d'attente avec une copie figée du projet, sans aucun résultat", async () => {
    const user = await createUser();
    const project = await createProject(user.id, projectInput({ geoQueries: ["Quel cabinet choisir ?"] }));
    const result = await requestAudit(user.id, project.id);
    if (!result.ok) throw new Error("échec inattendu");
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: result.auditId } });
    expect(audit).toMatchObject({ status: "QUEUED", isDemo: false, scoreTotal: null, reportSnapshot: null });
    expect(audit.inputSnapshot).toMatchObject({ siteUrl: project.siteUrl, companyName: project.companyName, geoQueries: ["Quel cabinet choisir ?"] });
  });

  it("refuse le projet d'un autre utilisateur, sans rien révéler", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const project = await createProject(alice.id, projectInput());
    expect(await requestAudit(bob.id, project.id)).toEqual({ ok: false, error: "NOT_FOUND" });
    const own = await requestAudit(alice.id, project.id);
    if (!own.ok) throw new Error("échec inattendu");
    expect(await getAuditReport(bob.id, own.auditId)).toBeNull();
    expect(await listAudits(bob.id, project.id)).toEqual([]);
  });

  it("refuse un projet de démonstration", async () => {
    const user = await createUser();
    const demo = await prisma.project.create({ data: { ...projectInput(), userId: user.id, isDemo: true, ownershipAttestedAt: new Date() } });
    expect(await requestAudit(user.id, demo.id)).toEqual({ ok: false, error: "DEMO_PROJECT" });
  });

  it("applique le quota quotidien", async () => {
    const user = await createUser();
    const project = await createProject(user.id, projectInput());
    await prisma.audit.createMany({
      data: Array.from({ length: MAX_AUDITS_PER_DAY }, () => ({ projectId: project.id, status: "SUCCEEDED" as const, scoringVersion: "cite-1.0.0", inputSnapshot: {} })),
    });
    expect(await requestAudit(user.id, project.id)).toEqual({ ok: false, error: "QUOTA" });
  });

  it("refuse un second audit tant que le premier est en attente ou en cours", async () => {
    const user = await createUser();
    const project = await createProject(user.id, projectInput());
    expect((await requestAudit(user.id, project.id)).ok).toBe(true);
    expect(await requestAudit(user.id, project.id)).toEqual({ ok: false, error: "ALREADY_RUNNING" });
  });

  it("des demandes simultanées ne créent qu'un seul audit", async () => {
    const user = await createUser();
    const project = await createProject(user.id, projectInput());
    // 20 demandes simultanées : niveau qui reproduisait le doublon avant le verrou.
    const results = await Promise.all(Array.from({ length: 20 }, () => requestAudit(user.id, project.id)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error === "ALREADY_RUNNING")).toHaveLength(19);
    expect(await prisma.audit.count({ where: { projectId: project.id } })).toBe(1);
  });

  it("des demandes simultanées sur plusieurs projets ne dépassent pas le quota quotidien", async () => {
    const user = await createUser();
    const projects = await Promise.all(Array.from({ length: 5 }, () => createProject(user.id, projectInput())));
    await prisma.audit.createMany({
      data: Array.from({ length: MAX_AUDITS_PER_DAY - 2 }, () => ({ projectId: projects[0].id, status: "SUCCEEDED" as const, scoringVersion: "cite-1.1.0", inputSnapshot: {} })),
    });
    const results = await Promise.all(projects.slice(1).map((p) => requestAudit(user.id, p.id)));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(await prisma.audit.count({ where: { project: { userId: user.id } } })).toBe(MAX_AUDITS_PER_DAY);
  });

  it("annule un audit resté en attente trop longtemps (worker absent) et en accepte un nouveau", async () => {
    const user = await createUser();
    const project = await createProject(user.id, projectInput());
    const old = await prisma.audit.create({
      data: { projectId: project.id, status: "QUEUED", scoringVersion: "cite-1.0.0", inputSnapshot: {}, queuedAt: new Date(Date.now() - QUEUED_STALE_MS - 1000) },
    });
    expect((await requestAudit(user.id, project.id)).ok).toBe(true);
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ status: "CANCELED", errorCode: "QUEUE_TIMEOUT" });
  });
});
