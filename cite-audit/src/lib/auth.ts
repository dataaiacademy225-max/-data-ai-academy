import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/constants";
import { sendEmail } from "@/server/email/send";
import { resetPasswordEmail, verifyEmailEmail } from "@/server/email/templates";

const RESET_TOKEN_SECONDS = 60 * 60; // 1 heure
const VERIFY_TOKEN_SECONDS = 24 * 60 * 60; // 24 heures

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
      resetPasswordTokenExpiresIn: RESET_TOKEN_SECONDS,
      // Après un changement de mot de passe, toutes les sessions ouvertes sont fermées.
      revokeSessionsOnPasswordReset: true,
      // Envoi sans attendre : la réponse ne révèle pas, par sa durée, si le compte existe.
      sendResetPassword: async ({ user, token }) => {
        const url = `${env.BETTER_AUTH_URL}/reset-password?token=${encodeURIComponent(token)}`;
        void sendEmail({ to: user.email, ...resetPasswordEmail({ name: user.name, url, validity: "1 heure" }) });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: VERIFY_TOKEN_SECONDS,
      sendVerificationEmail: async ({ user, url }) => {
        void sendEmail({ to: user.email, ...verifyEmailEmail({ name: user.name, url, validity: "24 heures" }) });
      },
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
