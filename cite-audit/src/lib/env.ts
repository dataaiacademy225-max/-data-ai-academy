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

const aiEnvSchema = z.object({
  /** Clé Perplexity : sans elle, le module de visibilité IA est désactivé. Jamais exposée au navigateur. */
  PERPLEXITY_API_KEY: z.string().min(10).optional().catch(undefined),
  /** « agent » : Agent API (/v1/responses, par défaut). « chat » : ancien format chat/completions. */
  PERPLEXITY_API_MODE: z.enum(["agent", "chat"]).default("agent").catch("agent"),
  PERPLEXITY_BASE_URL: z.url().startsWith("https://").default("https://api.perplexity.ai").catch("https://api.perplexity.ai"),
  AI_MAX_QUERIES_PER_RUN: z.coerce.number().int().min(1).max(20).default(10).catch(10),
  AI_MAX_QUERIES_PER_DAY: z.coerce.number().int().min(1).max(500).default(50).catch(50),
  AI_MIN_INTERVAL_MS: z.coerce.number().int().min(0).max(60_000).default(1500).catch(1500),
});

export type AiEnv = z.infer<typeof aiEnvSchema>;

/** Configuration du module IA, relue à chaque appel (permet d'activer le module sans redéploiement du code). */
export function getAiEnv(): AiEnv {
  const raw = { ...process.env };
  // Une variable vide équivaut à une variable absente.
  for (const key of Object.keys(aiEnvSchema.shape)) if (raw[key] === "") delete raw[key];
  return aiEnvSchema.parse(raw);
}

const retentionEnvSchema = z.object({
  /** Audits conservés N jours (le plus récent de chaque projet est toujours gardé). 0 = jamais supprimés. */
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(0).max(3650).default(730).catch(730),
  /** Mesures de visibilité IA (réponses brutes comprises) conservées N jours ; la plus récente de chaque projet est gardée. 0 = jamais. */
  AI_RUN_RETENTION_DAYS: z.coerce.number().int().min(0).max(3650).default(365).catch(365),
});

export type RetentionEnv = z.infer<typeof retentionEnvSchema>;

/** Durées de conservation. Une valeur absente, vide ou invalide prend la valeur par défaut. */
export function getRetentionEnv(): RetentionEnv {
  const raw = { ...process.env };
  for (const key of Object.keys(retentionEnvSchema.shape)) if (raw[key] === "") delete raw[key];
  return retentionEnvSchema.parse(raw);
}

const emailEnvSchema = z.object({
  /**
   * console : e-mails affichés dans le terminal (développement uniquement, refusé en production) ;
   * smtp : envoi réel via SMTP_URL (Brevo, Resend, Mailjet, OVH… proposent tous un accès SMTP) ;
   * memory : boîte d'envoi en mémoire, réservée aux tests automatiques.
   */
  EMAIL_TRANSPORT: z.enum(["console", "smtp", "memory"]).default("console"),
  /** smtps://utilisateur:motdepasse@smtp.exemple.com:465 (secret : variable d'environnement uniquement). */
  SMTP_URL: z.url().refine((u) => /^smtps?:\/\//.test(u), "SMTP_URL doit commencer par smtp:// ou smtps://").optional(),
  EMAIL_FROM: z.string().min(3).max(200).default("CITE Audit <no-reply@localhost>"),
});

export type EmailEnv = z.infer<typeof emailEnvSchema>;

/** Configuration de l'envoi d'e-mails. Les erreurs ne citent que le nom des variables, jamais leur valeur. */
export function getEmailEnv(): EmailEnv {
  const raw = { ...process.env };
  for (const key of Object.keys(emailEnvSchema.shape)) if (raw[key] === "") delete raw[key];
  const parsed = emailEnvSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Configuration e-mail invalide : ${fields}. Voir .env.example.`);
  }
  if (parsed.data.EMAIL_TRANSPORT === "smtp" && !parsed.data.SMTP_URL) {
    throw new Error("Configuration e-mail invalide : SMTP_URL est requise avec EMAIL_TRANSPORT=smtp.");
  }
  return parsed.data;
}
