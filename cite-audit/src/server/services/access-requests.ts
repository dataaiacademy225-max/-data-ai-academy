import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { AccessRequestInput } from "@/lib/validation/access-request";
import type { OutgoingEmail } from "@/server/email/send";
import { accessRequestEmail } from "@/server/email/templates";
import { consumeLimit, LIMITS, tooManyAttemptsMessage } from "@/server/services/rate-limit";

const DAY_MS = 86_400_000;

/** Durée de conservation des demandes d'accès (affichée dans la politique de confidentialité). */
export const ACCESS_REQUEST_RETENTION_DAYS = 365;

/**
 * Enregistre une demande d'accès. Une nouvelle demande de la même adresse dans les 24 h
 * n'est pas dupliquée : la réponse reste identique pour ne rien révéler.
 * Renvoie `created: false` dans ce cas, pour ne pas renvoyer de notification.
 */
export async function createAccessRequest(
  input: Omit<AccessRequestInput, "consent">,
  now = new Date(),
): Promise<{ created: boolean }> {
  const recent = await prisma.accessRequest.findFirst({
    where: { email: input.email, createdAt: { gte: new Date(now.getTime() - DAY_MS) } },
    select: { id: true },
  });
  if (recent) return { created: false };
  await prisma.accessRequest.create({ data: { ...input, createdAt: now } });
  return { created: true };
}

/** Demandes reçues, les plus récentes d'abord. Réservé au propriétaire : à vérifier par l'appelant. */
export async function listAccessRequests(limit = 200) {
  return prisma.accessRequest.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

export async function setAccessRequestHandled(id: string, handled: boolean, now = new Date()): Promise<boolean> {
  const { count } = await prisma.accessRequest.updateMany({ where: { id }, data: { handledAt: handled ? now : null } });
  return count > 0;
}

/** Suppression des demandes de plus de 12 mois (purge quotidienne). */
export async function purgeAccessRequests(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ACCESS_REQUEST_RETENTION_DAYS * DAY_MS);
  return (await prisma.accessRequest.deleteMany({ where: { createdAt: { lt: cutoff } } })).count;
}

export type SubmitResult = { ok: true } | { ok: false; error: string };

export type SubmitDeps = {
  sendEmail: (email: OutgoingEmail) => Promise<{ ok: boolean }>;
  appUrl: string;
  ownerEmails: string[];
  now?: Date;
};

/**
 * Traite une demande déjà validée : limites anti-abus, enregistrement, notification des propriétaires.
 * Aucun e-mail n'est envoyé à l'adresse saisie : le formulaire ne doit pas servir à écrire à un tiers.
 */
export async function submitAccessRequest(
  input: Omit<AccessRequestInput, "consent">,
  ip: string,
  deps: SubmitDeps,
): Promise<SubmitResult> {
  for (const [key, rule] of [
    [`access-request:ip:${ip}`, LIMITS.accessRequestPerIp],
    [`access-request:email:${input.email}`, LIMITS.accessRequestPerEmail],
  ] as const) {
    const limit = await consumeLimit(key, rule, deps.now);
    if (!limit.allowed) {
      logger.warn("access_request.rate_limited", {});
      return { ok: false, error: tooManyAttemptsMessage(limit.retryAfterMs) };
    }
  }

  const { created } = await createAccessRequest(input, deps.now);
  if (!created) return { ok: true };
  logger.info("access_request.created", {});

  const content = accessRequestEmail({ ...input, url: `${deps.appUrl.replace(/\/$/, "")}/settings/demandes-acces` });
  for (const to of deps.ownerEmails) {
    const { ok } = await deps.sendEmail({ to, ...content });
    if (!ok) logger.error("access_request.notify_failed", {});
  }
  return { ok: true };
}
