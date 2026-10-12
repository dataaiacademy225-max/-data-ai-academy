import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { ProjectInput } from "@/lib/validation/project";

export async function createUser(email = `user-${randomUUID()}@example.com`) {
  return prisma.user.create({ data: { id: randomUUID(), name: "Utilisateur test", email } });
}

export function projectInput(overrides: Partial<ProjectInput> = {}): ProjectInput {
  return {
    companyName: "Entreprise Test",
    siteUrl: "https://www.entreprise-test.com/",
    domain: "www.entreprise-test.com",
    sector: "Conseil",
    country: "CI",
    city: "Abidjan",
    primaryTarget: "Dirigeants de PME",
    competitors: [],
    geoQueries: [],
    ...overrides,
  };
}
