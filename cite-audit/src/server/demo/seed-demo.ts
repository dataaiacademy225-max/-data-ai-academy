import type { PrismaClient } from "@/generated/prisma/client";

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
export const DEMO_SCORING_VERSION = "demo";
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

  const now = new Date();
  await prisma.audit.create({
    data: {
      projectId: project.id,
      isDemo: true,
      status: "SUCCEEDED",
      scoringVersion: DEMO_SCORING_VERSION,
      queuedAt: now,
      startedAt: now,
      finishedAt: now,
      // Valeurs fictives, choisies à la main pour la démonstration de l'interface.
      scoreTotal: 58,
      scoreClarifier: 16,
      scoreIndexer: 19,
      scoreTunnel: 13,
      scoreEnclencher: 10,
      geoIndex: 41,
      coverage: 0.9,
      inputSnapshot: { demo: true, siteUrl: project.siteUrl, primaryTarget: project.primaryTarget },
      pages: {
        create: [
          {
            requestedUrl: "https://www.example.com/",
            finalUrl: "https://www.example.com/",
            httpStatus: 200,
            pageType: "home",
            robotsAllowed: true,
            bytes: 48_000,
            fetchMs: 420,
            facts: { demo: true, title: `${TAG} Cabinet Exemple Conseil`, h1: [`${TAG} Titre d'exemple`] },
          },
        ],
      },
      findings: {
        create: [
          {
            pillar: "CLARIFIER",
            criterionCode: "C3",
            priority: "IMPORTANT",
            observation: `${TAG} La cible principale n'apparaît pas dans le haut de la page d'accueil.`,
            evidence: [{ url: "https://www.example.com/", excerpt: `${TAG} extrait fictif` }],
            impact: `${TAG} Un visiteur peut mettre plus de temps à comprendre si l'offre s'adresse à lui.`,
            recommendation: `${TAG} Nommer la cible dans le titre principal ou la phrase qui le suit.`,
            effort: "faible",
          },
          {
            pillar: "ENCLENCHER",
            criterionCode: "E2",
            priority: "CRITIQUE",
            observation: `${TAG} Aucun formulaire ni lien de prise de rendez-vous détecté.`,
            evidence: [{ url: "https://www.example.com/" }],
            impact: `${TAG} Un prospect convaincu n'a pas de moyen simple de passer à l'action.`,
            recommendation: `${TAG} Ajouter un formulaire court (6 champs maximum) ou un lien de réservation.`,
            effort: "moyen",
          },
        ],
      },
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

  return { userId };
}
