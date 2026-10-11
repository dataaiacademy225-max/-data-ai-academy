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

/** Supprime le projet et, en cascade, ses audits, pages, problèmes et résultats IA. */
export async function deleteProject(userId: string, projectId: string): Promise<boolean> {
  const { count } = await prisma.project.deleteMany({ where: { id: projectId, userId } });
  return count === 1;
}
