import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { OutgoingEmail } from "@/server/email/send";
import { inactivityWarningEmail } from "@/server/email/templates";

const DAY_MS = 86_400_000;
/** Nombre maximal de comptes traités par passage (évite une rafale d'e-mails). */
const BATCH = 100;

export type InactiveAccountsConfig = { inactiveDays: number; graceDays: number };
export type InactiveAccountsDeps = {
  sendEmail: (email: OutgoingEmail) => Promise<{ ok: boolean }>;
  appUrl: string;
  now?: Date;
};

/** Date lisible en français, ex. « 12 novembre 2029 ». */
function frenchDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function frenchDuration(days: number): string {
  if (days % 365 === 0) return days === 365 ? "1 an" : `${days / 365} ans`;
  return `${days} jours`;
}

/** Une connexion (ou un renouvellement de session) remet le compte à zéro et annule l'avertissement. */
export async function markUserActive(userId: string, now = new Date()): Promise<void> {
  await prisma.user.updateMany({ where: { id: userId }, data: { lastActiveAt: now, inactivityWarnedAt: null } });
}

/**
 * Comptes inactifs, en deux temps (lancé chaque jour par le worker) :
 * 1. sans connexion depuis `inactiveDays` : e-mail d'avertissement ; le compte n'est marqué « averti »
 *    que si l'e-mail est parti, donc aucune suppression sans avertissement réel ;
 * 2. averti depuis `graceDays` sans s'être reconnecté : suppression du compte et, en cascade, de toutes ses données.
 * Le compte de démonstration (projets isDemo) n'est jamais concerné.
 */
export async function processInactiveAccounts(
  config: InactiveAccountsConfig,
  deps: InactiveAccountsDeps,
): Promise<{ warned: number; warningFailed: number; deleted: number }> {
  if (config.inactiveDays === 0) return { warned: 0, warningFailed: 0, deleted: 0 };
  const now = deps.now ?? new Date();
  const inactiveSince = new Date(now.getTime() - config.inactiveDays * DAY_MS);
  const notDemo = { projects: { none: { isDemo: true } } };

  // 1. Suppression des comptes avertis depuis assez longtemps et toujours inactifs.
  const warnedBefore = new Date(now.getTime() - config.graceDays * DAY_MS);
  const toDelete = await prisma.user.findMany({
    where: { ...notDemo, inactivityWarnedAt: { lte: warnedBefore }, lastActiveAt: { lt: inactiveSince } },
    select: { id: true },
    take: BATCH,
  });
  let deleted = 0;
  for (const { id } of toDelete) {
    // Revérifié au moment de supprimer : une reconnexion entre-temps annule la suppression.
    const { count } = await prisma.user.deleteMany({
      where: { id, inactivityWarnedAt: { lte: warnedBefore }, lastActiveAt: { lt: inactiveSince } },
    });
    if (count) logger.info("account.deleted_inactive", { userId: id });
    deleted += count;
  }

  // 2. Avertissement des comptes devenus inactifs.
  const toWarn = await prisma.user.findMany({
    where: { ...notDemo, inactivityWarnedAt: null, lastActiveAt: { lt: inactiveSince } },
    select: { id: true, name: true, email: true },
    take: BATCH,
  });
  const deletionDate = frenchDate(new Date(now.getTime() + config.graceDays * DAY_MS));
  let warned = 0;
  let warningFailed = 0;
  for (const user of toWarn) {
    const content = inactivityWarningEmail({
      name: user.name,
      url: `${deps.appUrl}/login`,
      inactiveFor: frenchDuration(config.inactiveDays),
      deletionDate,
    });
    const { ok } = await deps.sendEmail({ to: user.email, ...content });
    if (!ok) {
      warningFailed++;
      continue;
    }
    await prisma.user.updateMany({ where: { id: user.id, inactivityWarnedAt: null }, data: { inactivityWarnedAt: now } });
    warned++;
  }
  return { warned, warningFailed, deleted };
}
