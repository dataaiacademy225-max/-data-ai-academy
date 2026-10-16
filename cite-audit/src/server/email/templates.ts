import { interestLabel, sourceLabel } from "@/lib/acquisition";
import { APP_NAME, APP_NAME_PARTS, PUBLISHER_BRAND } from "@/lib/brand";

/**
 * Gabarits des e-mails transactionnels (fonctions pures, testées).
 * Le nom de l'utilisateur est une donnée saisie : toujours échappé dans la version HTML.
 */

export type EmailContent = { subject: string; text: string; html: string };

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function layout(paragraphs: string[], link: { url: string; label: string }, footer: string): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join("");
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f5f6f8;font-family:Arial,sans-serif;color:#0B1526">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px">
<p style="margin:0 0 24px;font-size:20px;font-weight:bold">${APP_NAME_PARTS.main}<span style="color:#FF7A29">${APP_NAME_PARTS.accent}</span></p>
${body}
<p style="margin:24px 0"><a href="${escapeHtml(link.url)}" style="background:#FF7A29;color:#0B1526;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(link.label)}</a></p>
<p style="margin:0 0 16px;font-size:13px;color:#555">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${escapeHtml(link.url)}</p>
<p style="margin:24px 0 0;font-size:12px;color:#777">${escapeHtml(footer)}</p>
</div></body></html>`;
}

const SIGNATURE = `${APP_NAME}, par ${PUBLISHER_BRAND}`;

export function resetPasswordEmail(input: { name: string; url: string; validity: string }): EmailContent {
  const paragraphs = [
    `Bonjour ${input.name},`,
    `Vous avez demandé à changer le mot de passe de votre compte ${APP_NAME}. Ce lien est valable ${input.validity} et ne peut servir qu'une fois.`,
    "Une fois le mot de passe changé, toutes vos sessions ouvertes seront fermées.",
  ];
  const footer = "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet e-mail : votre mot de passe reste inchangé.";
  return {
    subject: `Changer votre mot de passe ${APP_NAME}`,
    text: [...paragraphs, `Lien : ${input.url}`, footer, SIGNATURE].join("\n\n"),
    html: layout(paragraphs, { url: input.url, label: "Choisir un nouveau mot de passe" }, `${footer} — ${SIGNATURE}`),
  };
}

export function inactivityWarningEmail(input: {
  name: string;
  url: string;
  inactiveFor: string;
  deletionDate: string;
}): EmailContent {
  const paragraphs = [
    `Bonjour ${input.name},`,
    `Vous ne vous êtes pas connecté à votre compte ${APP_NAME} depuis ${input.inactiveFor}. Pour protéger vos données, les comptes inactifs sont supprimés.`,
    `Sans connexion de votre part, votre compte et toutes ses données (projets, audits, mesures IA) seront définitivement supprimés le ${input.deletionDate}.`,
    "Pour garder votre compte, il suffit de vous connecter avant cette date.",
  ];
  const footer = `Vous ne souhaitez plus utiliser ${APP_NAME} ? Ignorez cet e-mail : la suppression se fera automatiquement.`;
  return {
    subject: `Votre compte ${APP_NAME} sera supprimé faute de connexion`,
    text: [...paragraphs, `Lien : ${input.url}`, footer, SIGNATURE].join("\n\n"),
    html: layout(paragraphs, { url: input.url, label: "Me connecter et garder mon compte" }, `${footer} — ${SIGNATURE}`),
  };
}

export function verifyEmailEmail(input: { name: string; url: string; validity: string }): EmailContent {
  const paragraphs = [
    `Bonjour ${input.name},`,
    `Confirmez votre adresse e-mail pour sécuriser votre compte ${APP_NAME}. Ce lien est valable ${input.validity}.`,
  ];
  const footer = `Vous n'avez pas créé de compte ${APP_NAME} ? Ignorez cet e-mail.`;
  return {
    subject: "Confirmez votre adresse e-mail",
    text: [...paragraphs, `Lien : ${input.url}`, footer, SIGNATURE].join("\n\n"),
    html: layout(paragraphs, { url: input.url, label: "Confirmer mon adresse" }, `${footer} — ${SIGNATURE}`),
  };
}

export function auditFinishedEmail(input: {
  name: string;
  companyName: string;
  /** null : score global non vérifié (données insuffisantes). */
  score: number | null;
  url: string;
}): EmailContent {
  const scoreLine =
    input.score === null
      ? "Le score global n'a pas pu être calculé : certaines pages n'ont pas pu être analysées. Le rapport détaille ce qui a été mesuré et ce qui ne l'a pas été."
      : `Score CITE : ${input.score} / 100. C'est un indicateur interne ${PUBLISHER_BRAND}, calculé sur les signaux observables de votre site : ce n'est pas une mesure de Google ni d'une IA.`;
  const paragraphs = [
    `Bonjour ${input.name},`,
    `L'audit CITE du site de ${input.companyName} est terminé.`,
    scoreLine,
    "Le rapport classe les actions par priorité, avec la preuve observée pour chaque constat.",
  ];
  const footer = "Résultat non garanti : les recommandations peuvent renforcer la compréhension de votre marque, sans promesse de position ni de citation.";
  return {
    subject: `Audit terminé : ${input.companyName}`,
    text: [...paragraphs, `Lien : ${input.url}`, footer, SIGNATURE].join("\n\n"),
    html: layout(paragraphs, { url: input.url, label: "Voir le rapport" }, `${footer} — ${SIGNATURE}`),
  };
}

/** Prévient le propriétaire d'une nouvelle demande d'accès. Toutes les valeurs sont saisies par un inconnu : échappées. */
export function accessRequestEmail(input: {
  name: string;
  email: string;
  company: string | null;
  siteUrl: string | null;
  message: string | null;
  interest: string | null;
  source: string | null;
  campaign: string | null;
  url: string;
}): EmailContent {
  const paragraphs = [
    `Nouvelle demande d'accès à ${APP_NAME}.`,
    `Nom : ${input.name}`,
    `E-mail : ${input.email}`,
    `Entreprise : ${input.company ?? "non renseignée"}`,
    `Site : ${input.siteUrl ?? "non renseigné"}`,
    `Message : ${input.message ?? "aucun"}`,
    `Intérêt principal : ${interestLabel(input.interest)}`,
    `Provenance : ${sourceLabel(input.source)}${input.campaign ? ` (${input.campaign})` : ""}`,
    "Pour l'inviter, ajoutez son adresse à SIGNUP_ALLOWED_EMAILS sur Render, puis répondez-lui avec le lien d'inscription.",
  ];
  const footer = "Ces informations ont été saisies dans le formulaire public : vérifiez-les avant d'y donner suite.";
  return {
    // Le nom saisi n'entre pas dans l'objet : un en-tête d'e-mail ne doit contenir aucune donnée non fiable.
    subject: `Nouvelle demande d'accès à ${APP_NAME}`,
    text: [...paragraphs, `Toutes les demandes : ${input.url}`, footer, SIGNATURE].join("\n\n"),
    html: layout(paragraphs, { url: input.url, label: "Voir les demandes" }, `${footer} — ${SIGNATURE}`),
  };
}
