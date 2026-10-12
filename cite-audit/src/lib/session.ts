import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export type CurrentUser = { id: string; name: string; email: string; emailVerified: boolean };

/** Utilisateur connecté ou null. Vérification réelle côté serveur (pas seulement la présence du cookie). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, emailVerified } = session.user;
  return { id, name, email, emailVerified };
}

/** À appeler dans toute page, action ou route protégée. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
