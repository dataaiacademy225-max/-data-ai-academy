import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { projectFormSchema } from "@/lib/validation/project";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  projectToFormValues,
  updateProject,
} from "@/server/services/projects";
import { createUser, projectInput } from "./factories";

describe("service projets", () => {
  it("crée toujours un projet réel, avec la date d'attestation", async () => {
    const user = await createUser();
    const project = await createProject(user.id, projectInput({ competitors: [{ name: "A" }] }));
    expect(project.isDemo).toBe(false);
    expect(project.ownershipAttestedAt).toBeInstanceOf(Date);
    expect(project.competitors).toEqual([{ name: "A" }]);
  });

  it("isole les projets entre utilisateurs", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const aliceProject = await createProject(alice.id, projectInput({ companyName: "Projet d'Alice" }));

    expect(await listProjects(bob.id)).toEqual([]);
    expect(await getProject(bob.id, aliceProject.id)).toBeNull();
    expect(await deleteProject(bob.id, aliceProject.id)).toBe(false);

    // Le projet d'Alice est intact.
    expect(await getProject(alice.id, aliceProject.id)).not.toBeNull();
    expect((await listProjects(alice.id)).map((p) => p.companyName)).toEqual(["Projet d'Alice"]);
  });

  it("le propriétaire peut supprimer son projet", async () => {
    const user = await createUser();
    const project = await createProject(user.id, projectInput());
    expect(await deleteProject(user.id, project.id)).toBe(true);
    expect(await getProject(user.id, project.id)).toBeNull();
  });

  it("liste les projets réels avant les projets de démonstration", async () => {
    const user = await createUser();
    const { prisma } = await import("@/lib/db");
    await prisma.project.create({
      data: { ...projectInput({ companyName: "Démo" }), userId: user.id, isDemo: true, ownershipAttestedAt: new Date() },
    });
    await createProject(user.id, projectInput({ companyName: "Réel" }));
    expect((await listProjects(user.id)).map((p) => p.companyName)).toEqual(["Réel", "Démo"]);
  });

  it("le propriétaire peut modifier son projet ; un autre utilisateur, non", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const project = await createProject(alice.id, projectInput());
    const changes = projectInput({
      companyName: "Nouveau nom",
      siteUrl: "https://nouveau-site.com/",
      domain: "nouveau-site.com",
      geoQueries: ["meilleur cabinet conseil Abidjan"],
    });

    expect(await updateProject(bob.id, project.id, changes)).toBe(false);
    expect((await getProject(alice.id, project.id))?.companyName).toBe("Entreprise Test");

    expect(await updateProject(alice.id, project.id, changes)).toBe(true);
    const updated = await getProject(alice.id, project.id);
    expect(updated).toMatchObject({ companyName: "Nouveau nom", domain: "nouveau-site.com", isDemo: false });
    expect(updated?.geoQueries).toEqual(["meilleur cabinet conseil Abidjan"]);
  });

  it("refuse de modifier ou supprimer un projet de démonstration", async () => {
    const user = await createUser();
    const demo = await prisma.project.create({
      data: { ...projectInput({ companyName: "[DÉMO] Projet" }), userId: user.id, isDemo: true, ownershipAttestedAt: new Date() },
    });
    expect(await updateProject(user.id, demo.id, projectInput({ companyName: "Piraté" }))).toBe(false);
    expect(await deleteProject(user.id, demo.id)).toBe(false);
    expect((await getProject(user.id, demo.id))?.companyName).toBe("[DÉMO] Projet");
  });

  it("supprime en cascade audits, pages, recommandations et mesures IA, sans toucher aux autres projets", async () => {
    const user = await createUser();
    const project = await createProject(user.id, projectInput());
    const other = await createProject(user.id, projectInput({ companyName: "Autre projet" }));

    for (const p of [project, other]) {
      const audit = await prisma.audit.create({
        data: { projectId: p.id, scoringVersion: "test", inputSnapshot: {}, status: "SUCCEEDED" },
      });
      await prisma.pageAnalysis.create({ data: { auditId: audit.id, requestedUrl: p.siteUrl, robotsAllowed: true } });
      await prisma.finding.create({
        data: {
          auditId: audit.id,
          pillar: "CLARIFIER",
          criterionCode: "C1",
          priority: "IMPORTANT",
          observation: "constat",
          evidence: {},
          impact: "impact",
          recommendation: "action",
        },
      });
      await prisma.aiVisibilityRun.create({
        data: {
          projectId: p.id,
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

    expect(await deleteProject(user.id, project.id)).toBe(true);

    const remaining = async (projectId: string) => ({
      audits: await prisma.audit.count({ where: { projectId } }),
      pages: await prisma.pageAnalysis.count({ where: { audit: { projectId } } }),
      findings: await prisma.finding.count({ where: { audit: { projectId } } }),
      runs: await prisma.aiVisibilityRun.count({ where: { projectId } }),
      results: await prisma.aiQueryResult.count({ where: { run: { projectId } } }),
    });
    expect(await remaining(project.id)).toEqual({ audits: 0, pages: 0, findings: 0, runs: 0, results: 0 });
    expect(await remaining(other.id)).toEqual({ audits: 1, pages: 1, findings: 1, runs: 1, results: 1 });
    // Aucune ligne orpheline dans toute la base.
    expect(await prisma.pageAnalysis.count()).toBe(1);
    expect(await prisma.aiQueryResult.count()).toBe(1);
  });

  it("préremplit le formulaire avec des valeurs qui repassent la validation, sauf l'attestation redemandée", async () => {
    const user = await createUser();
    const project = await createProject(
      user.id,
      projectInput({
        competitors: [{ name: "Concurrent A", url: "https://concurrent-a.com/" }, { name: "Concurrent B" }],
        geoQueries: ["cabinet conseil Abidjan", "formation data Abidjan"],
      }),
    );
    const values = projectToFormValues(project);
    expect(values.ownershipAttested).toBe("");
    expect(projectFormSchema.safeParse(values).success).toBe(false);

    const parsed = projectFormSchema.safeParse({ ...values, ownershipAttested: "on" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.competitors).toEqual(project.competitors);
      expect(parsed.data.geoQueries).toEqual(project.geoQueries);
      expect(parsed.data.siteUrl).toBe(project.siteUrl);
    }
  });
});
