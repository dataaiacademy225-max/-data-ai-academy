import {
  contentUnreadable,
  fail,
  findLinks,
  homeEvidence,
  homeNotVerified,
  LINK_KINDS,
  linkEvidence,
  notVerified,
  partial,
  pass,
  type Rule,
} from "@/server/scoring/criteria/shared";
import { normalize } from "@/server/scoring/text";
import type { Evidence } from "@/server/scoring/types";

const BOOKING = /calendly\.com|cal\.com|zcal\.co|tidycal|hubspot\.com\/meetings|meet\.google|outlook\.office\.com\/bookings|calendar\.app\.google/i;
const MAX_FORM_FIELDS = 6;
const LOW_COMMITMENT =
  /\b(diagnostic\w*|audit (offert|gratuit)|gratuit\w*|offert\w*|essai|demo|demonstration|devis|telecharg\w*|guide|livre blanc|webinai?re?|consultation|appel decouverte|free|trial|download)\b/;
const REASSURANCE =
  /\b(reponse sous|repondons sous|sous \d+ ?h|sous 24|sous 48|dans les 24|dans les 48|sans engagement|confidenti\w*|rgpd|donnees personnelles|vos donnees)\b/;

export const E1: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const emails = [...new Set(view.okPages.flatMap((p) => p.analysis.facts.contactLinks.emails))];
  const phones = [...new Set(view.okPages.flatMap((p) => p.analysis.facts.contactLinks.phones))];
  const contactLinks = findLinks(view.home.facts.internalLinks, LINK_KINDS.contact);
  const signals = [emails.length > 0, phones.length > 0, contactLinks.length > 0].filter(Boolean).length;
  const evidence: Evidence[] = [
    ...(emails.length ? [homeEvidence(view, "E-mail cliquable", `${emails.length} adresse(s)`)] : []),
    ...(phones.length ? [homeEvidence(view, "Téléphone cliquable", phones[0])] : []),
    ...linkEvidence(contactLinks, "Lien vers la page contact"),
  ];
  const missing = [
    ...(emails.length ? [] : ["E-mail cliquable"]),
    ...(phones.length ? [] : ["Téléphone cliquable"]),
    ...(contactLinks.length ? [] : ["Lien vers une page contact"]),
  ];
  if (signals >= 2) return pass(`${signals} moyens de contact sur 3 sont accessibles (e-mail, téléphone, page contact).`, evidence);
  if (signals === 1) return partial(0.5, "Un seul moyen de contact est accessible depuis les pages analysées.", missing, evidence);
  return fail("Aucun e-mail, téléphone cliquable ou lien vers une page contact n'a été trouvé.", missing, [homeEvidence(view, "Pages analysées")]);
};

export const E2: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const booking = view.okPages.flatMap((p) => p.analysis.facts.ctas).filter((c) => c.href && BOOKING.test(c.href));
  const bookingLinks = view.externalLinks.filter((l) => BOOKING.test(l.url));
  const forms = view.okPages.flatMap((p) => p.analysis.facts.forms.map((f) => ({ ...f, url: p.analysis.finalUrl })));
  const shortForms = forms.filter((f) => f.fieldCount <= MAX_FORM_FIELDS);
  const evidence: Evidence[] = [
    ...booking.slice(0, 2).map((c) => ({ url: c.href ?? undefined, label: "Prise de rendez-vous en ligne", excerpt: c.text })),
    ...bookingLinks.slice(0, 1).map((l) => ({ url: l.url, label: "Lien de réservation" })),
    ...forms.slice(0, 2).map((f) => ({ url: f.url, label: `Formulaire de ${f.fieldCount} champ(s)`, excerpt: f.submitText ?? undefined })),
  ];
  if (booking.length > 0 || bookingLinks.length > 0 || shortForms.length > 0) {
    const what = booking.length || bookingLinks.length ? "Une prise de rendez-vous en ligne" : `Un formulaire de ${shortForms[0].fieldCount} champ(s)`;
    return pass(`${what} est proposé(e).`, evidence);
  }
  if (forms.length > 0) {
    return partial(0.6, `Un formulaire existe mais il demande ${forms[0].fieldCount} champs (objectif : ${MAX_FORM_FIELDS} maximum).`, [`Un formulaire de ${MAX_FORM_FIELDS} champs maximum`], evidence);
  }
  const contactLinks = findLinks(view.home.facts.internalLinks, LINK_KINDS.contact);
  const contactAnalyzed = view.okPages.some((p) => p.role === "contact");
  if (contactLinks.length > 0 && !contactAnalyzed) {
    return notVerified("Non vérifié : aucun formulaire sur la page d'accueil, et la page contact (qui peut en contenir un) n'a pas été analysée.");
  }
  return fail("Aucun formulaire ni lien de prise de rendez-vous n'a été trouvé.", ["Un formulaire court ou un lien de réservation"], [homeEvidence(view, "Pages analysées")]);
};

export const E3: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const ctas = view.home.facts.ctas;
  if (ctas.length === 0) return fail("Aucune action n'est proposée sur la page d'accueil.", ["Une action principale répétée"], [homeEvidence(view, "Page d'accueil")], "MEDIUM");
  const key = (c: (typeof ctas)[number]) => c.href ?? normalize(c.text);
  const repeated = ctas.find((c) => c.position === "top" && ctas.some((o) => o !== c && o.position === "rest" && key(o) === key(c)));
  if (repeated) {
    return pass(`L'action « ${repeated.text} » est proposée en haut et plus bas dans la page.`, [homeEvidence(view, "Action répétée", repeated.text)], "MEDIUM");
  }
  return partial(0.5, `${ctas.length} action(s) repérée(s), mais aucune n'est répétée en haut et plus bas dans la page.`, ["La même action principale en haut et en bas de page"], ctas.slice(0, 3).map((c) => homeEvidence(view, c.position === "top" ? "Action en haut" : "Action plus bas", c.text)), "MEDIUM");
};

export const E4: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const candidates = [
    ...view.okPages.flatMap((p) => p.analysis.facts.ctas.map((c) => ({ text: c.text, url: c.href ?? p.analysis.finalUrl }))),
    ...view.internalLinks.map((l) => ({ text: l.text, url: l.url })),
  ];
  const found = candidates.find((c) => LOW_COMMITMENT.test(normalize(c.text)));
  if (found) return pass(`Une première étape facile est proposée : « ${found.text} ».`, [{ url: found.url, label: "Premier pas proposé", excerpt: found.text }], "MEDIUM");
  return fail("Aucune première étape à faible engagement (diagnostic, démo, devis, guide) n'a été repérée.", ["Diagnostic offert, démonstration, devis ou guide"], [homeEvidence(view, "Boutons et liens analysés")], "MEDIUM");
};

export const E5: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const legal = findLinks(view.internalLinks, LINK_KINDS.legal);
  const sentence = view.allText.split(/(?<=[.!?])\s+/).find((s) => REASSURANCE.test(normalize(s)));
  const evidence: Evidence[] = [
    ...linkEvidence(legal, "Mentions légales / confidentialité"),
    ...(sentence ? [homeEvidence(view, "Phrase de réassurance", sentence)] : []),
  ];
  const missing = [
    ...(legal.length ? [] : ["Lien vers mentions légales ou politique de confidentialité"]),
    ...(sentence ? [] : ["Délai de réponse ou engagement de confidentialité près du contact"]),
  ];
  if (legal.length && sentence) return pass("Mentions légales accessibles et message de réassurance présent.", evidence, "MEDIUM");
  if (legal.length || sentence) return partial(0.5, legal.length ? "Les mentions légales sont accessibles, mais aucun message de réassurance (délai de réponse, confidentialité) n'a été repéré." : "Un message de réassurance est présent, mais aucun lien vers les mentions légales ou la confidentialité.", missing, evidence, "MEDIUM");
  return fail("Ni mentions légales, ni politique de confidentialité, ni message de réassurance n'ont été repérés.", missing, [homeEvidence(view, "Pages analysées")], "MEDIUM");
};

export const E6: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const urls = [...view.externalLinks.map((l) => l.url), ...view.okPages.flatMap((p) => p.analysis.facts.ctas.map((c) => c.href ?? ""))];
  const channels = [
    { name: "WhatsApp", ok: urls.some((u) => /wa\.me|whatsapp\.com/i.test(u)) },
    { name: "LinkedIn", ok: urls.some((u) => /linkedin\.com/i.test(u)) },
    { name: "Téléphone cliquable", ok: view.okPages.some((p) => p.analysis.facts.contactLinks.phones.length > 0) },
    { name: "Messenger / Telegram", ok: urls.some((u) => /m\.me\/|messenger\.com|t\.me\//i.test(u)) },
  ];
  const ok = channels.filter((c) => c.ok);
  const evidence = ok.map((c) => homeEvidence(view, `Canal : ${c.name}`));
  const missing = channels.filter((c) => !c.ok).slice(0, 3).map((c) => c.name);
  if (ok.length >= 2) return pass(`${ok.length} canaux directs proposés : ${ok.map((c) => c.name).join(", ")}.`, evidence);
  if (ok.length === 1) return partial(0.5, `Un seul canal direct proposé (${ok[0].name}).`, missing, evidence);
  return fail("Aucun canal direct (WhatsApp, LinkedIn, téléphone) n'a été repéré.", missing, [homeEvidence(view, "Pages analysées")]);
};
