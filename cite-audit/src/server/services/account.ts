import "server-only";
import { prisma } from "@/lib/db";

export type PasswordVerifier = (data: { password: string; hash: string }) => Promise<boolean>;

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" | "WRONG_PASSWORD" | "DEMO_ACCOUNT" };

/**
 * Supprime définitivement le compte et toutes ses données : sessions, identifiants, projets,
 * audits, pages analysées, recommandations, mesures IA (suppression en cascade en base).
 * Le mot de passe est revérifié ; la fonction de vérification est injectée (celle de Better Auth en production).
 */
export async function deleteAccount(
  userId: string,
  password: string,
  verify: PasswordVerifier,
): Promise<DeleteAccountResult> {
  const credential = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { password: true },
  });
  if (!credential?.password) return { ok: false, error: "NOT_FOUND" };
  if (!(await verify({ password, hash: credential.password }))) return { ok: false, error: "WRONG_PASSWORD" };

  // Le compte de démonstration est partagé et recréé par le seed : il ne se supprime pas depuis l'interface.
  if (await prisma.project.count({ where: { userId, isDemo: true } })) return { ok: false, error: "DEMO_ACCOUNT" };

  const { count } = await prisma.user.deleteMany({ where: { id: userId } });
  return count === 1 ? { ok: true } : { ok: false, error: "NOT_FOUND" };
}
