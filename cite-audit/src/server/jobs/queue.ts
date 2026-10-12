import { prisma } from "@/lib/db";

/**
 * File d'attente des audits, stockée dans PostgreSQL (pas de Redis).
 * Un audit QUEUED est pris par un seul worker grâce à « FOR UPDATE SKIP LOCKED ».
 * Un audit RUNNING dont le verrou n'est plus renouvelé (worker arrêté) est repris, au plus MAX_ATTEMPTS fois.
 */

/** Sans signe de vie depuis ce délai, un audit en cours est considéré comme abandonné. */
export const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
export const MAX_ATTEMPTS = 3;

/** Marque en échec les audits abandonnés qui ont épuisé leurs tentatives. */
export async function failExhaustedAudits(lockTimeoutMs = LOCK_TIMEOUT_MS): Promise<number> {
  return prisma.$executeRaw`
    UPDATE "Audit"
    SET status = 'FAILED', "errorCode" = 'TOO_MANY_ATTEMPTS', "finishedAt" = now()
    WHERE status = 'RUNNING'
      AND attempts >= ${MAX_ATTEMPTS}
      AND "lockedAt" < now() - make_interval(secs => ${lockTimeoutMs / 1000})`;
}

/** Prend en charge le plus ancien audit disponible ; renvoie son identifiant, ou null. */
export async function claimNextAudit(lockTimeoutMs = LOCK_TIMEOUT_MS): Promise<string | null> {
  await failExhaustedAudits(lockTimeoutMs);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Audit"
    SET status = 'RUNNING', "lockedAt" = now(), "startedAt" = COALESCE("startedAt", now()), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "Audit"
      WHERE "isDemo" = false
        AND (
          status = 'QUEUED'
          OR (status = 'RUNNING' AND attempts < ${MAX_ATTEMPTS} AND "lockedAt" < now() - make_interval(secs => ${lockTimeoutMs / 1000}))
        )
      ORDER BY "queuedAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id`;
  return rows[0]?.id ?? null;
}

/** Signe de vie + progression affichée à l'utilisateur. */
export async function reportProgress(auditId: string, progress: { phase: string; pagesDone: number; pagesTotal: number }) {
  await prisma.audit.updateMany({
    where: { id: auditId, status: "RUNNING" },
    data: { progress, lockedAt: new Date() },
  });
}
