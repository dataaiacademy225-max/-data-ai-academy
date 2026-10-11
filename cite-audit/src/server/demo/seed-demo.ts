import type { PrismaClient } from "@/generated/prisma/client";
import { extractPageFacts } from "@/server/crawler/extract";
import { DEMO_HOME_HTML, DEMO_SITE_URL } from "@/server/demo/demo-site";
import { scoreSite, type PageInput } from "@/server/scoring";
import { saveAuditResult } from "@/server/services/audit-results";

/**
 * Données de démonstration.
 *
 * Règles de séparation avec les données réelles :
 * - elles appartiennent à un compte dédié (DEMO_EMAIL, domaine réservé example.com) ;
 * - chaque projet et audit porte isDemo = true. La clé étrangère composite
 *   Audit(projectId, isDemo) → Project(id, isDemo) empêche en base de rattacher
 *   un audit de démonstration à un projet réel, et inversement ;
 * - chaque texte est préfixé [DÉMO] ;
 * - le seed ne supprime que ce compte, et refuse s'il possède un projet réel.
 */

export const DEMO_EMAIL = "demo@example.com";
export const DEMO_NAME = "Compte de démonstration";
const TAG = "[DÉMO]";

type SignUp = (input: { name: string; email: string; password: string }) => Promise<{ userId: string }>;

export async function seedDemo(prisma: PrismaClient, signUp: SignUp, password: string) {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true, projects: { where: { isDemo: false }, select: { id: true } } },
  });
  if (existing && existing.projects.length > 0) {
    throw new Error("Le compte de démonstration contient des projets réels : seed annulé, rien n'a été supprimé.");
  }
  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } }); // cascade : sessions, projets démo, audits démo
  }

  const { userId } = await signUp({ name: DEMO_NAME, email: DEMO_EMAIL, password });

  const project = await prisma.project.create({
    data: {
      userId,
      isDemo: true,
      companyName: `${TAG} Cabinet Exemple Conseil`,
      siteUrl: "https://www.example.com/",
      domain: "www.example.com",
      sector: "Cabinet de conseil en data",
      country: "CI",
      city: "Abidjan",
      primaryTarget: "Dirigeants de PME B2B",
      competitors: [{ name: `${TAG} Concurrent A` }, { name: `${TAG} Concurrent B`, url: "https://www.example.org/" }],
      geoQueries: ["Quel cabinet de conseil en data choisir à Abidjan ?"],
      ownershipAttestedAt: new Date(),
    },
  });

  // Un second projet de démonstration, sans audit, pour illustrer l'état « aucun audit ».
  await prisma.project.create({
    data: {
      userId,
      isDemo: true,
      companyName: `${TAG} SaaS Exemple`,
      siteUrl: "https://www.example.net/",
      domain: "www.example.net",
      sector: "Logiciel de facturation B2B",
      country: "FR",
      primaryTarget: "Directeurs administratifs et financiers",
      ownershipAttestedAt: new Date(),
    },
  });

  // Audit de démonstration : le VRAI moteur de scoring appliqué à une page fictive (aucun appel réseau).
  const context = {
    companyName: "Cabinet Exemple Conseil",
    sector: project.sector,
    primaryTarget: project.primaryTarget,
    city: project.city,
    country: project.country,
    geoQueries: project.geoQueries,
  };
  const pages: PageInput[] = [
    {
      role: "home",
      url: DEMO_SITE_URL,
      ok: true,
      analysis: {
        requestedUrl: DEMO_SITE_URL,
        finalUrl: DEMO_SITE_URL,
        httpStatus: 200,
        redirectChain: [],
        contentType: "text/html; charset=utf-8",
        bytes: DEMO_HOME_HTML.length,
        fetchMs: 0,
        xRobotsTag: null,
        robotsTxt: "ALLOWED",
        facts: extractPageFacts(DEMO_HOME_HTML, DEMO_SITE_URL),
      },
    },
  ];
  const result = scoreSite({ context, pages, site: {} });
  const now = new Date();
  const audit = await prisma.audit.create({
    data: {
      projectId: project.id,
      isDemo: true,
      status: "RUNNING",
      scoringVersion: result.scoringVersion,
      queuedAt: now,
      startedAt: now,
      inputSnapshot: { demo: true, siteUrl: project.siteUrl, ...context },
      aiResults: {
        create: [
          {
            query: "Quel cabinet de conseil en data choisir à Abidjan ?",
            provider: "OPENAI_COMPATIBLE",
            model: "demo-model",
            brandMentioned: false,
            brandRecommended: false,
            competitorsMentioned: [],
            sources: [],
            rawResponse: `${TAG} Réponse fictive de démonstration : aucun appel à une IA n'a été effectué.`,
            confidence: 1,
          },
        ],
      },
    },
  });
  await prisma.$transaction((tx) => saveAuditResult(tx, audit.id, pages, result, { textPrefix: `${TAG} ` }));

  return { userId };
}
