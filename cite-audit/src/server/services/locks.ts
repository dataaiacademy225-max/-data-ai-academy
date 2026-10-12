import { Prisma } from "@/generated/prisma/client";

/**
 * Verrou PostgreSQL limité à la transaction en cours (libéré automatiquement au commit ou à l'annulation).
 * Sert à rendre atomique « vérifier les limites puis créer » quand plusieurs demandes arrivent en même temps.
 */
export async function lockForTransaction(tx: Prisma.TransactionClient, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
