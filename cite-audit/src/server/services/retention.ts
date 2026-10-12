import "server-only";
import { prisma } from "@/lib/db";
import type { RetentionEnv } from "@/lib/env";
import { purgeExpiredLimits } from "@/server/services/rate-limit";

const DAY_MS = 86_400_000;

export type PurgeReport = {
  sessions: number;
  verifications: number;
  limits: number;
  audits: number;
  aiRuns: number;
};

/**
 * Purge des données dont la durée de conservation est dépassée (lancée par le worker une fois par jour).
 * - sessions et jetons de vérification expirés, compteurs anti-abus de plus de 24 h : toujours ;
 * - audits et mesures IA plus anciens que la durée choisie, sauf le plus récent de chaque projet,
 *   pour qu'un projet garde toujours son dernier rapport ;
 * - jamais un travail en attente ou en cours, jamais les données de démonstration (gérées par le seed).
 * Les pages analysées, recommandations et réponses IA suivent en cascade.
 */
export async function purgeExpiredData(
  config: Pick<RetentionEnv, "AUDIT_RETENTION_DAYS" | "AI_RUN_RETENTION_DAYS">,
  now = new Date(),
): Promise<PurgeReport> {
  const sessions = (await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  const verifications = (await prisma.verification.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  const limits = await purgeExpiredLimits(now);

  let audits = 0;
  if (config.AUDIT_RETENTION_DAYS > 0) {
    const cutoff = new Date(now.getTime() - config.AUDIT_RETENTION_DAYS * DAY_MS);
    audits = await prisma.$executeRaw`
      DELETE FROM "Audit" a
      WHERE a."queuedAt" < ${cutoff}
        AND a."isDemo" = false
        AND a."status" NOT IN ('QUEUED', 'RUNNING')
        AND a."id" NOT IN (SELECT DISTINCT ON ("projectId") "id" FROM "Audit" ORDER BY "projectId", "queuedAt" DESC)`;
  }

  let aiRuns = 0;
  if (config.AI_RUN_RETENTION_DAYS > 0) {
    const cutoff = new Date(now.getTime() - config.AI_RUN_RETENTION_DAYS * DAY_MS);
    aiRuns = await prisma.$executeRaw`
      DELETE FROM "AiVisibilityRun" r
      WHERE r."queuedAt" < ${cutoff}
        AND r."isDemo" = false
        AND r."status" NOT IN ('QUEUED', 'RUNNING')
        AND r."id" NOT IN (SELECT DISTINCT ON ("projectId") "id" FROM "AiVisibilityRun" ORDER BY "projectId", "queuedAt" DESC)`;
  }

  return { sessions, verifications, limits, audits, aiRuns };
}
