import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/constants";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Adresse e-mail invalide.").max(254, "Adresse e-mail trop longue."));

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mot de passe : ${PASSWORD_MIN_LENGTH} caractères minimum.`)
  .max(128, "Mot de passe : 128 caractères maximum.");

const passwordsMatch = {
  path: ["confirmPassword"],
  message: "Les deux mots de passe ne correspondent pas.",
};

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Saisissez votre mot de passe.").max(128),
});

export const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Nom : 2 caractères minimum.")
      .max(80, "Nom : 80 caractères maximum."),
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, passwordsMatch);

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "Lien invalide.").max(512, "Lien invalide."),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, passwordsMatch);

export type SignInValues = z.input<typeof signInSchema>;
export type SignUpValues = z.input<typeof signUpSchema>;
