"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { requireUser } from "@/lib/session";
import { deleteAccount } from "@/server/services/account";

export type DeleteAccountState = { error?: string };

const CONFIRMATION_WORD = "SUPPRIMER";

/** Suppression définitive du compte : mot de passe actuel + mot de confirmation. */
export async function deleteAccountAction(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const user = await requireUser();
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");
  if (typeof confirmation !== "string" || confirmation.trim().toUpperCase() !== CONFIRMATION_WORD) {
    return { error: `Saisissez ${CONFIRMATION_WORD} pour confirmer : le compte n'a pas été supprimé.` };
  }
  if (typeof password !== "string" || !password || password.length > 128) {
    return { error: "Saisissez votre mot de passe actuel." };
  }

  const auth = getAuth();
  const ctx = await auth.$context;
  const result = await deleteAccount(user.id, password, (data) => ctx.password.verify(data));
  if (!result.ok) {
    if (result.error === "WRONG_PASSWORD") {
      logger.warn("account.delete_wrong_password", { userId: user.id });
      return { error: "Mot de passe incorrect : le compte n'a pas été supprimé." };
    }
    if (result.error === "DEMO_ACCOUNT") return { error: "Le compte de démonstration ne peut pas être supprimé." };
    return { error: "Compte introuvable." };
  }
  logger.info("account.deleted", { userId: user.id });

  // Les sessions ont été supprimées en base avec le compte ; on efface aussi le cookie du navigateur.
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Session déjà supprimée : le cookie restant n'ouvre plus aucun accès.
  }
  redirect("/login?compte=supprime");
}
