import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getAuditReport, listAudits, MAX_AUDITS_PER_DAY, runHomepageAudit } from "@/server/services/audits";
import { createProject } from "@/server/services/projects";
import { analysisFromHtml, fixture } from "../helpers/scoring-fixtures";
import { createUser, projectInput } from "./factories";

const input = projectInput({
  companyName: "Cabinet Clair",
  siteUrl: "https://www.cabinet-clair.com/",
  domain: "www.cabinet-clair.com",
  sector: "Conseil data",
  primaryTarget: "Dirigeants de PME",
});

// Aucune requête réseau : l'analyse est simulée à partir d'un HTML de test.
const analyzeOk = (name: string) => async () => ({ ok: true as const, value: analysisFromHtml(fixture(name)) });

describe("runHomepageAudit", () => {
  it("analyse, note et enregistre l'audit, la page et les recommandations", async () => {
    const user = await createUser();
    const project = await createProject(user.id, input);
    const result = await runHomepageAudit(user.id, project.id, { analyze: analyzeOk("weak-conversion") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: result.auditId }, include: { pages: true, findings: true } });
    expect(audit.status).toBe("SUCCEEDED");
    expect(audit.isDemo).toBe(false);
    expect(audit.scoreTotal).toBeGreaterThan(0);
    expect(audit.scoreTotal).toBe(
      Math.round(audit.scoreClarifier! + audit.scoreIndexer! + audit.scoreTunnel! + audit.scoreEnclencher!),
    );
    expect(audit.pages).toHaveLength(1);
    expect(audit.pages[0]).toMatchObject({ httpStatus: 200, pageType: "home", fetchError: null });
    expect(audit.findings.length).toBeGreaterThan(5);
    expect(audit.findings.map((f) => f.priority)).toContain("CRITIQUE");
    // Aucun texte de démonstration dans un audit réel.
    expect(audit.findings.some((f) => f.observation.includes("[DÉMO]"))).toBe(false);

    const report = await getAuditReport(user.id, result.auditId);
    expect(report?.report?.scoreTotal).toBe(audit.scoreTotal);
  });

  it("site inaccessible : audit terminé sans score, constat enregistré", async () => {
    const user = await createUser();
    const project = await createProject(user.id, input);
    const result = await runHomepageAudit(user.id, project.id, {
      analyze: async () => ({ ok: false, error: { code: "HTTP_ERROR", message: "", httpStatus: 503, url: input.siteUrl } }),
    });
    if (!result.ok) throw new Error("échec inattendu");
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: result.auditId }, include: { pages: true, findings: true } });
    expect(audit).toMatchObject({ status: "PARTIAL", scoreTotal: null, scoreClarifier: null });
    expect(audit.pages[0]).toMatchObject({ fetchError: "HTTP_ERROR", httpStatus: 503 });
    expect(audit.findings.map((f) => f.criterionCode)).toEqual(["I1"]);
  });

  it("erreur imprévue : audit marqué en échec, sans résultat inventé", async () => {
    const user = await createUser();
    const project = await createProject(user.id, input);
    const result = await runHomepageAudit(user.id, project.id, {
      analyze: async () => {
        throw new Error("panne");
      },
    });
    expect(result).toEqual({ ok: false, error: "INTERNAL" });
    const [audit] = await listAudits(user.id, project.id);
    expect(audit).toMatchObject({ status: "FAILED", scoreTotal: null });
  });

  it("refuse le projet d'un autre utilisateur et ne révèle pas son rapport", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const project = await createProject(alice.id, input);
    expect(await runHomepageAudit(bob.id, project.id, { analyze: analyzeOk("complete") })).toEqual({ ok: false, error: "NOT_FOUND" });

    const own = await runHomepageAudit(alice.id, project.id, { analyze: analyzeOk("complete") });
    if (!own.ok) throw new Error("échec inattendu");
    expect(await getAuditReport(bob.id, own.auditId)).toBeNull();
    expect(await listAudits(bob.id, project.id)).toEqual([]);
  });

  it("refuse d'auditer un projet de démonstration", async () => {
    const user = await createUser();
    const demo = await prisma.project.create({
      data: { ...input, userId: user.id, isDemo: true, ownershipAttestedAt: new Date() },
    });
    expect(await runHomepageAudit(user.id, demo.id, { analyze: analyzeOk("complete") })).toEqual({ ok: false, error: "DEMO_PROJECT" });
  });

  it("applique le quota quotidien", async () => {
    const user = await createUser();
    const project = await createProject(user.id, input);
    await prisma.audit.createMany({
      data: Array.from({ length: MAX_AUDITS_PER_DAY }, () => ({ projectId: project.id, status: "SUCCEEDED" as const, scoringVersion: "cite-1.0.0", inputSnapshot: {} })),
    });
    expect(await runHomepageAudit(user.id, project.id, { analyze: analyzeOk("complete") })).toEqual({ ok: false, error: "QUOTA" });
  });

  it("refuse un second audit simultané sur le même projet", async () => {
    const user = await createUser();
    const project = await createProject(user.id, input);
    await prisma.audit.create({ data: { projectId: project.id, status: "RUNNING", scoringVersion: "cite-1.0.0", inputSnapshot: {} } });
    expect(await runHomepageAudit(user.id, project.id, { analyze: analyzeOk("complete") })).toEqual({ ok: false, error: "ALREADY_RUNNING" });
  });
});
