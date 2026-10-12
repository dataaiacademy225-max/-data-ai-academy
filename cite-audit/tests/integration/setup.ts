import { afterAll, beforeEach } from "vitest";
import { getTestDatabaseUrl } from "./test-db";

// Doit précéder tout import de "@/lib/db" : le client Prisma lit DATABASE_URL au premier usage.
process.env.DATABASE_URL = getTestDatabaseUrl();
// Inscriptions ouvertes par défaut dans les tests ; le mode invitation a ses propres tests.
process.env.SIGNUP_MODE = "open";

const { prisma } = await import("@/lib/db");

beforeEach(async () => {
  // Les suppressions en cascade vident projets, audits, pages, problèmes et résultats IA ; puis les limites anti-abus.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "user", "verification", "rateLimit", "ActionLimit" CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});
