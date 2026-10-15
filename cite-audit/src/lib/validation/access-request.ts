import { z } from "zod";

/**
 * Formulaire public de demande d'accès. Toutes les valeurs sont des données non fiables :
 * elles sont seulement stockées et affichées comme du texte (jamais visitées, jamais interprétées).
 */

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} : ${max} caractères maximum.`)
    .transform((v) => (v === "" ? null : v));

const siteUrl = z
  .string()
  .trim()
  .max(300, "Adresse du site : 300 caractères maximum.")
  .transform((raw, ctx) => {
    if (raw === "") return null;
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(withScheme);
      if (!url.hostname.includes(".")) throw new Error("hôte");
      return url.toString();
    } catch {
      ctx.addIssue({ code: "custom", message: "Adresse du site invalide (exemple : monsite.com)." });
      return z.NEVER;
    }
  });

export const accessRequestSchema = z.object({
  name: z.string().trim().min(2, "Nom : 2 caractères minimum.").max(80, "Nom : 80 caractères maximum."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Adresse e-mail invalide.").max(254, "Adresse e-mail trop longue.")),
  company: optionalText(120, "Entreprise"),
  siteUrl,
  message: optionalText(1000, "Message"),
  consent: z.literal("on", { error: "Cochez la case pour accepter le traitement de votre demande." }),
});

export type AccessRequestInput = z.infer<typeof accessRequestSchema>;
