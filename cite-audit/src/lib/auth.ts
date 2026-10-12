import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/constants";

function createAuth() {
  const env = getServerEnv();
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 jours
      updateAge: 60 * 60 * 24,
    },
    // Limite des routes HTTP /api/auth/* (les server actions ont leur propre limite : services/rate-limit.ts).
    // Stockage en base : la limite tient après un redémarrage et avec plusieurs instances.
    rateLimit: {
      enabled: process.env.NODE_ENV === "production",
      window: 60,
      max: 20,
      storage: "database",
    },
    // nextCookies doit rester le dernier plugin : il pose les cookies depuis les server actions.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;

/** Instance Better Auth créée au premier usage (les variables d'environnement sont alors validées). */
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
