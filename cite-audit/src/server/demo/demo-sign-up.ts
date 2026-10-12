import { getAuth } from "@/lib/auth";
import { DEMO_EMAIL } from "@/server/demo/seed-demo";

/**
 * Crée le compte de démonstration via Better Auth (mot de passe haché comme pour tout compte).
 * En mode « inscriptions sur invitation », l'adresse démo est autorisée pour CET appel seulement,
 * dans le processus du seed (ligne de commande) : jamais depuis l'interface.
 */
export async function signUpDemoUser(body: { name: string; email: string; password: string }): Promise<{ userId: string }> {
  const previous = process.env.SIGNUP_ALLOWED_EMAILS;
  process.env.SIGNUP_ALLOWED_EMAILS = [previous, DEMO_EMAIL].filter(Boolean).join(",");
  try {
    const res = await getAuth().api.signUpEmail({ body });
    return { userId: res.user.id };
  } finally {
    if (previous === undefined) delete process.env.SIGNUP_ALLOWED_EMAILS;
    else process.env.SIGNUP_ALLOWED_EMAILS = previous;
  }
}
