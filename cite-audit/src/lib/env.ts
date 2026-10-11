import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET doit contenir au moins 32 caractères"),
  BETTER_AUTH_URL: z.url(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/**
 * Variables d'environnement serveur, validées au premier accès.
 * Lecture paresseuse pour ne pas casser `next build` quand elles sont absentes.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    // Ne jamais afficher les valeurs : seulement les noms des variables en cause.
    throw new Error(`Configuration invalide ou manquante : ${fields}. Voir .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
