import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getEmailEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { EmailContent } from "@/server/email/templates";

export type OutgoingEmail = EmailContent & { to: string };

/** Boîte d'envoi des tests automatiques (EMAIL_TRANSPORT=memory). Jamais utilisée en production. */
export const testOutbox: OutgoingEmail[] = [];

let smtp: { url: string; transporter: Transporter } | undefined;

/**
 * Envoie un e-mail transactionnel. Ne lève jamais d'exception : un échec est journalisé
 * (sans destinataire, sans contenu, sans lien) et renvoyé comme résultat.
 */
export async function sendEmail(email: OutgoingEmail): Promise<{ ok: boolean }> {
  let env;
  try {
    env = getEmailEnv();
  } catch (error) {
    logger.error("email.misconfigured", { error });
    return { ok: false };
  }

  if (env.EMAIL_TRANSPORT === "memory") {
    if (process.env.NODE_ENV !== "test") {
      logger.error("email.memory_transport_outside_tests", {});
      return { ok: false };
    }
    testOutbox.push(email);
    return { ok: true };
  }

  if (env.EMAIL_TRANSPORT === "console") {
    if (process.env.NODE_ENV === "production") {
      // En production, un lien de connexion ne doit jamais finir dans les journaux.
      logger.error("email.not_configured", { subject: email.subject });
      return { ok: false };
    }
    // Développement uniquement : affichage volontaire hors du journal structuré, pour pouvoir cliquer le lien.
    console.info(`\n──── E-mail (non envoyé, mode console) ────\nÀ : ${email.to}\nObjet : ${email.subject}\n\n${email.text}\n───────────────────────────────────────────\n`);
    return { ok: true };
  }

  try {
    if (!smtp || smtp.url !== env.SMTP_URL) {
      smtp = { url: env.SMTP_URL as string, transporter: nodemailer.createTransport(env.SMTP_URL as string) };
    }
    await smtp.transporter.sendMail({ from: env.EMAIL_FROM, to: email.to, subject: email.subject, text: email.text, html: email.html });
    logger.info("email.sent", { subject: email.subject });
    return { ok: true };
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    logger.error("email.send_failed", { subject: email.subject, code: typeof code === "string" ? code : undefined });
    return { ok: false };
  }
}
