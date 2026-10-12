import { getAccessEnv, type AccessEnv } from "@/lib/env";

/**
 * Règles d'accès à l'application (fonctions pures, configuration injectable pour les tests).
 * La liste des propriétaires vient d'une variable d'environnement serveur, jamais de la base :
 * personne ne peut se donner ce statut depuis l'interface.
 */

export function isSignupAllowed(email: string, env: AccessEnv = getAccessEnv()): boolean {
  if (env.SIGNUP_MODE === "open") return true;
  const normalized = email.trim().toLowerCase();
  return env.OWNER_EMAILS.includes(normalized) || env.SIGNUP_ALLOWED_EMAILS.includes(normalized);
}

/**
 * Propriétaire : adresse déclarée dans OWNER_EMAILS ET confirmée par le lien reçu par e-mail.
 * Sans la confirmation, quelqu'un qui s'inscrirait le premier avec cette adresse obtiendrait les droits.
 */
export function isOwner(user: { email: string; emailVerified: boolean }, env: AccessEnv = getAccessEnv()): boolean {
  return user.emailVerified && env.OWNER_EMAILS.includes(user.email.trim().toLowerCase());
}
