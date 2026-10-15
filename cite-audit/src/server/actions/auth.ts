"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { isSignupAllowed } from "@/lib/access";
import { clientIp } from "@/lib/client-ip";
import { logger } from "@/lib/logger";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";
import { consumeLimit, LIMITS, resetLimit, tooManyAttemptsMessage } from "@/server/services/rate-limit";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: { name?: string; email?: string };
};

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = { email: readString(formData, "email"), password: readString(formData, "password") };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: { email: raw.email } };
  }

  // Limites anti-abus : par adresse IP et par e-mail (devinette de mot de passe).
  const requestHeaders = await headers();
  const emailKey = `sign-in:email:${parsed.data.email.toLowerCase()}`;
  for (const [key, rule] of [
    [`sign-in:ip:${clientIp(requestHeaders)}`, LIMITS.signInPerIp],
    [emailKey, LIMITS.signInPerEmail],
  ] as const) {
    const limit = await consumeLimit(key, rule);
    if (!limit.allowed) {
      logger.warn("auth.sign_in_rate_limited", {});
      return { error: tooManyAttemptsMessage(limit.retryAfterMs), values: { email: raw.email } };
    }
  }

  let needsSecondFactor = false;
  try {
    const result = await getAuth().api.signInEmail({ body: parsed.data, headers: requestHeaders });
    // Double authentification active : aucune session n'est encore ouverte, le code est demandé à l'étape suivante.
    needsSecondFactor = "twoFactorRedirect" in result && result.twoFactorRedirect === true;
  } catch (error) {
    if (isAPIError(error)) {
      // Message volontairement identique que l'e-mail existe ou non.
      return { error: "E-mail ou mot de passe incorrect.", values: { email: raw.email } };
    }
    logger.error("auth.sign_in_failed", { error });
    return { error: "Connexion impossible pour le moment. Réessayez.", values: { email: raw.email } };
  }
  await resetLimit(emailKey);
  redirect(needsSecondFactor ? "/login/double-authentification" : "/dashboard");
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    name: readString(formData, "name"),
    email: readString(formData, "email"),
    password: readString(formData, "password"),
    confirmPassword: readString(formData, "confirmPassword"),
  };
  const values = { name: raw.name, email: raw.email };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  if (!isSignupAllowed(parsed.data.email)) {
    return { error: "Les inscriptions se font sur invitation pour le moment. Faites une demande depuis la page « Demander un accès ».", values };
  }

  const requestHeaders = await headers();
  const limit = await consumeLimit(`sign-up:ip:${clientIp(requestHeaders)}`, LIMITS.signUpPerIp);
  if (!limit.allowed) {
    logger.warn("auth.sign_up_rate_limited", {});
    return { error: tooManyAttemptsMessage(limit.retryAfterMs), values };
  }

  try {
    const { name, email, password } = parsed.data;
    await getAuth().api.signUpEmail({ body: { name, email, password, callbackURL: "/dashboard" }, headers: requestHeaders });
  } catch (error) {
    if (isAPIError(error)) {
      return { error: "Impossible de créer un compte avec cette adresse e-mail.", values };
    }
    logger.error("auth.sign_up_failed", { error });
    return { error: "Inscription impossible pour le moment. Réessayez.", values };
  }
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}
