import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Limite de tentatives par clé (e-mail, adresse IP, utilisateur), stockée en PostgreSQL :
 * elle tient après un redémarrage et avec plusieurs instances de l'application.
 * Fenêtre fixe : au-delà de `max` tentatives dans `windowMs`, refus jusqu'à la fin de la fenêtre.
 */

export type LimitRule = { max: number; windowMs: number };
export type LimitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

export const LIMITS = {
  signInPerEmail: { max: 10, windowMs: 15 * 60_000 },
  signInPerIp: { max: 50, windowMs: 15 * 60_000 },
  signUpPerIp: { max: 10, windowMs: 60 * 60_000 },
  deleteAccountPerUser: { max: 5, windowMs: 15 * 60_000 },
  passwordResetPerIp: { max: 10, windowMs: 60 * 60_000 },
  passwordResetPerEmail: { max: 3, windowMs: 60 * 60_000 },
  verificationEmailPerUser: { max: 3, windowMs: 60 * 60_000 },
} as const satisfies Record<string, LimitRule>;

/** Empreinte de la clé : aucune donnée personnelle (e-mail, IP) n'est stockée en clair. */
function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Compte une tentative et indique si elle est autorisée. Opération atomique (une seule requête SQL). */
export async function consumeLimit(key: string, rule: LimitRule, now = new Date()): Promise<LimitResult> {
  const cutoff = new Date(now.getTime() - rule.windowMs);
  const [row] = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "ActionLimit" ("key", "count", "windowStart") VALUES (${hashKey(key)}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "ActionLimit"."windowStart" <= ${cutoff} THEN 1 ELSE "ActionLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "ActionLimit"."windowStart" <= ${cutoff} THEN ${now} ELSE "ActionLimit"."windowStart" END
    RETURNING "count", "windowStart"`;
  if (row.count <= rule.max) return { allowed: true };
  return { allowed: false, retryAfterMs: Math.max(0, row.windowStart.getTime() + rule.windowMs - now.getTime()) };
}

/** Efface le compteur (ex. après une connexion réussie). */
export async function resetLimit(key: string): Promise<void> {
  await prisma.actionLimit.deleteMany({ where: { key: hashKey(key) } });
}

/** Supprime les compteurs expirés (appelé par la purge périodique du worker). */
export async function purgeExpiredLimits(now = new Date(), maxWindowMs = 24 * 60 * 60_000): Promise<number> {
  const { count } = await prisma.actionLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - maxWindowMs) } } });
  return count;
}

/** Message affiché, en minutes arrondies au-dessus. */
export function tooManyAttemptsMessage(retryAfterMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  return `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`;
}
