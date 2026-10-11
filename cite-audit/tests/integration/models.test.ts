import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createUser } from "./factories";

async function createProject(userId: string, isDemo = false) {
  return prisma.project.create({
    data: {
      userId,
      isDemo,
      companyName: "Entreprise",
      siteUrl: "https://www.entreprise-test.com/",
      domain: "www.entreprise-test.com",
      sector: "Conseil",
      country: "CI",
      primaryTarget: "PME",
      ownershipAttestedAt: new Date(),
    },
  });
}

async function createAudit(projectId: string, isDemo = false) {
  return prisma.audit.create({
    data: { projectId, isDemo, scoringVersion: "cite-1.0.0", inputSnapshot: {} },
  });
}

describe("User", () => {
  it("impose l'unicité de l'e-mail", async () => {
    await createUser("unique@example.com");
    await expect(createUser("unique@example.com")).rejects.toThrow();
  });
});

describe("Project", () => {
  it("applique des valeurs par défaut sûres", async () => {
    const user = await createUser();
    const project = await createProject(user.id);
    expect(project.isDemo).toBe(false);
    expect(project.competitors).toEqual([]);
    expect(project.geoQueries).toEqual([]);
  });

  it("exige un propriétaire existant", async () => {
    await expect(createProject("utilisateur-inexistant")).rejects.toThrow();
  });
});

describe("Audit", () => {
  it("démarre en file d'attente, sans aucun résultat", async () => {
    const user = await createUser();
    const audit = await createAudit((await createProject(user.id)).id);
    expect(audit.status).toBe("QUEUED");
    expect(audit.scoreTotal).toBeNull();
    expect(audit.scoreClarifier).toBeNull();
    expect(audit.geoIndex).toBeNull();
    expect(audit.reportSnapshot).toBeNull();
  });

  it("refuse en base un audit de démonstration sur un projet réel", async () => {
    const user = await createUser();
    const realProject = await createProject(user.id, false);
    await expect(createAudit(realProject.id, true)).rejects.toThrow();
  });

  it("refuse en base un audit réel sur un projet de démonstration", async () => {
    const user = await createUser();
    const demoProject = await createProject(user.id, true);
    await expect(createAudit(demoProject.id, false)).rejects.toThrow();
  });
});

describe("PageAnalysis, Finding, AiQueryResult", () => {
  it("se rattachent à un audit et conservent la réponse brute à l'identique", async () => {
    const user = await createUser();
    const audit = await createAudit((await createProject(user.id)).id);
    const raw = "  Réponse brute\n<script>alert(1)</script>  **sans** retouche ";

    await prisma.pageAnalysis.create({
      data: { auditId: audit.id, requestedUrl: "https://www.entreprise-test.com/", robotsAllowed: true },
    });
    await prisma.finding.create({
      data: {
        auditId: audit.id,
        pillar: "INDEXER",
        criterionCode: "I4",
        priority: "IMPORTANT",
        observation: "Constat",
        evidence: [{ url: "https://www.entreprise-test.com/" }],
        impact: "Impact",
        recommendation: "Recommandation",
      },
    });
    const ai = await prisma.aiQueryResult.create({
      data: {
        auditId: audit.id,
        query: "Question",
        provider: "PERPLEXITY",
        model: "modele-test",
        brandMentioned: true,
        brandRecommended: false,
        rawResponse: raw,
        confidence: 0.8,
      },
    });

    expect((await prisma.aiQueryResult.findUniqueOrThrow({ where: { id: ai.id } })).rawResponse).toBe(raw);
    expect(ai.sources).toEqual([]);
    expect(ai.competitorsMentioned).toEqual([]);
  });

  it("refuse une priorité hors des trois niveaux", async () => {
    const user = await createUser();
    const audit = await createAudit((await createProject(user.id)).id);
    await expect(
      prisma.finding.create({
        data: {
          auditId: audit.id,
          pillar: "TUNNEL",
          criterionCode: "T1",
          // @ts-expect-error valeur volontairement invalide
          priority: "URGENT",
          observation: "x",
          evidence: [],
          impact: "x",
          recommendation: "x",
        },
      }),
    ).rejects.toThrow();
  });
});

describe("Suppression en cascade", () => {
  it("supprimer un projet efface ses audits et tous leurs résultats", async () => {
    const user = await createUser();
    const project = await createProject(user.id);
    const audit = await createAudit(project.id);
    await prisma.pageAnalysis.create({
      data: { auditId: audit.id, requestedUrl: "https://www.entreprise-test.com/", robotsAllowed: true },
    });

    await prisma.project.delete({ where: { id: project.id } });

    expect(await prisma.audit.count()).toBe(0);
    expect(await prisma.pageAnalysis.count()).toBe(0);
  });

  it("supprimer un utilisateur efface ses projets", async () => {
    const user = await createUser();
    await createProject(user.id);
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.project.count()).toBe(0);
  });
});
