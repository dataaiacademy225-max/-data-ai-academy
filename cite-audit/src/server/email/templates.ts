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
<p style="margin:0 0 24px;font-size:20px;font-weight:bold">CITE <span style="color:#FF7A29">Audit</span></p>
${body}
<p style="margin:24px 0"><a href="${escapeHtml(link.url)}" style="background:#FF7A29;color:#0B1526;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(link.label)}</a></p>
<p style="margin:0 0 16px;font-size:13px;color:#555">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${escapeHtml(link.url)}</p>
<p style="margin:24px 0 0;font-size:12px;color:#777">${escapeHtml(footer)}</p>
</div></body></html>`;
}

const SIGNATURE = "CITE Audit, par Data & AI Academy";

export function resetPasswordEmail(input: { name: string; url: string; validity: string }): EmailContent {
  const paragraphs = [
    `Bonjour ${input.name},`,
    `Vous avez demandé à changer le mot de passe de votre compte CITE Audit. Ce lien est valable ${input.validity} et ne peut servir qu'une fois.`,
    "Une fois le mot de passe changé, toutes vos sessions ouvertes seront fermées.",
  ];
  const footer = "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet e-mail : votre mot de passe reste inchangé.";
  return {
    subject: "Changer votre mot de passe CITE Audit",
    text: [...paragraphs, `Lien : ${input.url}`, footer, SIGNATURE].join("\n\n"),
    html: layout(paragraphs, { url: input.url, label: "Choisir un nouveau mot de passe" }, `${footer} — ${SIGNATURE}`),
  };
}

export function verifyEmailEmail(input: { name: string; url: string; validity: string }): EmailContent {
  const paragraphs = [
    `Bonjour ${input.name},`,
    `Confirmez votre adresse e-mail pour sécuriser votre compte CITE Audit. Ce lien est valable ${input.validity}.`,
  ];
  const footer = "Vous n'avez pas créé de compte CITE Audit ? Ignorez cet e-mail.";
  return {
    subject: "Confirmez votre adresse e-mail",
    text: [...paragraphs, `Lien : ${input.url}`, footer, SIGNATURE].join("\n\n"),
    html: layout(paragraphs, { url: input.url, label: "Confirmer mon adresse" }, `${footer} — ${SIGNATURE}`),
  };
}
