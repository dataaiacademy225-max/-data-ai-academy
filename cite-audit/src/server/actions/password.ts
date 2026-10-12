"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { logger } from "@/lib/logger";
import { requireUser } from "@/lib/session";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation/auth";
import { consumeLimit, LIMITS, tooManyAttemptsMessage } from "@/server/services/rate-limit";

export type PasswordFormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  sent?: boolean;
  values?: { email?: string };
};

/** Demande d'un lien de changement de mot de passe. Même réponse que le compte existe ou non. */
export async function requestPasswordResetAction(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const raw = { email: String(formData.get("email") ?? "") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: raw };

  const requestHeaders = await headers();
  for (const [key, rule] of [
    [`password-reset:ip:${clientIp(requestHeaders)}`, LIMITS.passwordResetPerIp],
    [`password-reset:email:${parsed.data.email}`, LIMITS.passwordResetPerEmail],
  ] as const) {
    const limit = await consumeLimit(key, rule);
    if (!limit.allowed) return { error: tooManyAttemptsMessage(limit.retryAfterMs), values: raw };
  }

  try {
    await getAuth().api.requestPasswordReset({ body: { email: parsed.data.email }, headers: requestHeaders });
  } catch (error) {
    // Erreur journalisée, mais la réponse reste identique : elle ne doit pas révéler si le compte existe.
    logger.error("auth.password_reset_request_failed", { error });
  }
  return { sent: true };
}

/** Choix du nouveau mot de passe à partir du lien reçu par e-mail. */
export async function resetPasswordAction(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    if (fieldErrors.token) return { error: "Lien invalide ou expiré. Demandez un nouveau lien." };
    return { fieldErrors };
  }

  try {
    await getAuth().api.resetPassword({ body: { newPassword: parsed.data.password, token: parsed.data.token } });
  } catch (error) {
    if (isAPIError(error)) return { error: "Lien invalide ou expiré. Demandez un nouveau lien." };
    logger.error("auth.password_reset_failed", { error });
    return { error: "Le mot de passe n'a pas pu être changé. Réessayez." };
  }
  logger.info("auth.password_reset_done", {});
  redirect("/login?motdepasse=modifie");
}

export type VerificationState = { message?: string; error?: string };

/** Renvoi de l'e-mail de confirmation d'adresse pour l'utilisateur connecté. */
export async function resendVerificationEmailAction(): Promise<VerificationState> {
  const user = await requireUser();
  if (user.emailVerified) return { message: "Votre adresse est déjà confirmée." };
  const limit = await consumeLimit(`verify-email:user:${user.id}`, LIMITS.verificationEmailPerUser);
  if (!limit.allowed) return { error: tooManyAttemptsMessage(limit.retryAfterMs) };
  try {
    await getAuth().api.sendVerificationEmail({ body: { email: user.email, callbackURL: "/dashboard" }, headers: await headers() });
  } catch (error) {
    logger.error("auth.verification_email_failed", { error });
    return { error: "L'e-mail n'a pas pu être envoyé. Réessayez plus tard." };
  }
  return { message: "E-mail envoyé. Pensez à vérifier vos courriers indésirables." };
}
