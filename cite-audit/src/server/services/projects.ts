import { prisma } from "@/lib/db";
import type { ProjectInput } from "@/lib/validation/project";

export const MAX_PROJECTS_PER_USER = 50;

/**
 * Accès aux projets. Chaque fonction exige l'identifiant de l'utilisateur connecté
 * et filtre dessus : un projet d'un autre utilisateur est introuvable (jamais « interdit »).
 */

export async function createProject(userId: string, input: ProjectInput) {
  return prisma.project.create({
    data: {
      userId,
      companyName: input.companyName,
      siteUrl: input.siteUrl,
      domain: input.domain,
      sector: input.sector,
      country: input.country,
      city: input.city,
      primaryTarget: input.primaryTarget,
      competitors: input.competitors,
      geoQueries: input.geoQueries,
      ownershipAttestedAt: new Date(),
      // Un projet créé depuis l'application est toujours réel.
      isDemo: false,
    },
  });
}

export async function listProjects(userId: string) {
  return prisma.project.findMany({
    where: { userId },
    orderBy: [{ isDemo: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      companyName: true,
      siteUrl: true,
      sector: true,
      country: true,
      city: true,
      isDemo: true,
      createdAt: true,
      audits: {
        orderBy: { queuedAt: "desc" },
        take: 1,
        select: { id: true, status: true, scoreTotal: true, finishedAt: true },
      },
    },
  });
}

export async function getProject(userId: string, projectId: string) {
  return prisma.project.findFirst({ where: { id: projectId, userId } });
}

/**
 * Modifie un projet réel de l'utilisateur. Les audits déjà réalisés gardent leur copie figée des paramètres.
 * Renvoie false si le projet n'existe pas, appartient à un autre utilisateur ou est un projet de démonstration.
 */
export async function updateProject(userId: string, projectId: string, input: ProjectInput): Promise<boolean> {
  const { count } = await prisma.project.updateMany({
    where: { id: projectId, userId, isDemo: false },
    data: {
      companyName: input.companyName,
      siteUrl: input.siteUrl,
      domain: input.domain,
      sector: input.sector,
      country: input.country,
      city: input.city,
      primaryTarget: input.primaryTarget,
      competitors: input.competitors,
      geoQueries: input.geoQueries,
      ownershipAttestedAt: new Date(),
    },
  });
  return count === 1;
}

/**
 * Supprime un projet réel et, en cascade, ses audits, pages analysées, recommandations et mesures IA.
 * Les projets de démonstration sont gérés uniquement par le seed.
 */
export async function deleteProject(userId: string, projectId: string): Promise<boolean> {
  const { count } = await prisma.project.deleteMany({ where: { id: projectId, userId, isDemo: false } });
  return count === 1;
}

/** Valeurs du formulaire à partir d'un projet existant (format « une ligne par élément »). */
export function projectToFormValues(project: {
  companyName: string;
  siteUrl: string;
  sector: string;
  country: string;
  city: string | null;
  primaryTarget: string;
  competitors: unknown;
  geoQueries: string[];
}): Record<string, string> {
  const competitors = Array.isArray(project.competitors) ? (project.competitors as { name?: string; url?: string }[]) : [];
  return {
    companyName: project.companyName,
    siteUrl: project.siteUrl,
    sector: project.sector,
    country: project.country,
    city: project.city ?? "",
    primaryTarget: project.primaryTarget,
    competitors: competitors.map((c) => (c.url ? `${c.name} | ${c.url}` : (c.name ?? ""))).join("\n"),
    geoQueries: project.geoQueries.join("\n"),
    // L'adresse du site peut changer : l'attestation de propriété est redemandée à chaque modification.
    ownershipAttested: "",
  };
}
