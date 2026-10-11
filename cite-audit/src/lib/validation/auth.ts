import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/constants";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Adresse e-mail invalide.").max(254, "Adresse e-mail trop longue."));

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
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Mot de passe : ${PASSWORD_MIN_LENGTH} caractères minimum.`)
      .max(128, "Mot de passe : 128 caractères maximum."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les deux mots de passe ne correspondent pas.",
  });

export type SignInValues = z.input<typeof signInSchema>;
export type SignUpValues = z.input<typeof signUpSchema>;
