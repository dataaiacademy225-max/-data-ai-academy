"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

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

  try {
    await getAuth().api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    if (isAPIError(error)) {
      // Message volontairement identique que l'e-mail existe ou non.
      return { error: "E-mail ou mot de passe incorrect.", values: { email: raw.email } };
    }
    logger.error("auth.sign_in_failed", { error });
    return { error: "Connexion impossible pour le moment. Réessayez.", values: { email: raw.email } };
  }
  redirect("/dashboard");
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

  try {
    const { name, email, password } = parsed.data;
    await getAuth().api.signUpEmail({ body: { name, email, password }, headers: await headers() });
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
