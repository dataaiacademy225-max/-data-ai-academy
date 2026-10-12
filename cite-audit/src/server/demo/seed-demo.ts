import type { PrismaClient } from "@/generated/prisma/client";
import { extractPageFacts } from "@/server/crawler/extract";
import { analyzeResponse } from "@/server/ai-visibility/analyze";
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
    },
  });
  await prisma.$transaction((tx) => saveAuditResult(tx, audit.id, pages, result, { textPrefix: `${TAG} ` }));

  // Mesure de visibilité IA de démonstration : réponses FICTIVES (aucun appel à une IA), lues par le vrai analyseur.
  const brand = { name: "Cabinet Exemple Conseil", url: DEMO_SITE_URL };
  const competitors = [{ name: "Concurrent A", url: null }, { name: "Concurrent B", url: "https://www.example.org/" }];
  const demoAnswers = [
    {
      query: "Quel cabinet de conseil en data choisir à Abidjan ?",
      text: `${TAG} Réponse fictive. Plusieurs cabinets interviennent à Abidjan :\n1. Concurrent A, spécialisé en tableaux de bord.\n2. Cabinet Exemple Conseil, qui accompagne les PME (https://www.example.com/).\n3. Concurrent B.`,
      sources: [{ url: "https://www.example.com/", title: "[DÉMO] Cabinet Exemple Conseil", origin: "API" as const }],
    },
    {
      query: "Meilleur consultant data pour PME en Côte d'Ivoire",
      text: `${TAG} Réponse fictive. Je recommande Concurrent A pour les PME qui débutent avec leurs données.`,
      sources: [{ url: "https://www.example.org/", title: "[DÉMO] Concurrent B", origin: "API" as const }],
    },
  ];
  await prisma.aiVisibilityRun.create({
    data: {
      projectId: project.id,
      isDemo: true,
      status: "SUCCEEDED",
      provider: "PERPLEXITY",
      model: "perplexity/sonar",
      queryCount: demoAnswers.length,
      estimatedCostMinUsd: 0,
      estimatedCostMaxUsd: 0,
      startedAt: now,
      finishedAt: now,
      progress: { done: demoAnswers.length, total: demoAnswers.length },
      inputSnapshot: { demo: true, brand, competitors },
      results: {
        create: demoAnswers.map((a, position) => {
          const analysis = analyzeResponse(a.text, a.sources, brand, competitors);
          return {
            position,
            query: a.query,
            status: "SUCCEEDED" as const,
            attempts: 1,
            provider: "PERPLEXITY" as const,
            requestedModel: "perplexity/sonar",
            model: "demo-model",
            askedAt: now,
            rawResponse: a.text,
            rawPayload: { demo: true },
            sources: analysis.sources,
            brandDetected: analysis.brand.detectedAs,
            brandMentioned: analysis.brand.mentioned,
            brandCited: analysis.brand.cited,
            brandRecommended: analysis.brand.recommended,
            approxPosition: analysis.brand.approxPosition,
            positionRatio: analysis.brand.positionRatio,
            brandExcerpt: analysis.brand.excerpt,
            competitorsMentioned: analysis.competitors,
            confidence: analysis.confidence,
          };
        }),
      },
    },
  });

  return { userId };
}
