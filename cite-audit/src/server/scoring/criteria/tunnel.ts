import type { ProofType } from "@/server/crawler/types";
import {
  contentUnreadable,
  fail,
  findLinks,
  homeEvidence,
  homeNotVerified,
  LINK_KINDS,
  linkEvidence,
  notApplicable,
  notVerified,
  partial,
  pass,
  share,
  type Rule,
} from "@/server/scoring/criteria/shared";
import { matchedTerms, normalize, terms } from "@/server/scoring/text";

const PROOF_LABELS: Record<ProofType, string> = {
  testimonial: "témoignage",
  client_logos: "logos clients",
  case_study: "étude de cas",
  result_figure: "chiffre de résultat",
  certification: "certification",
  rating: "note ou avis",
};

/** Libellés trop vagues pour un bouton d'action. */
const GENERIC_CTA = /^(en savoir plus|savoir plus|decouvrir|decouvrez|voir plus|lire la suite|cliquez ici|ici|plus|learn more|read more|more|click here|discover)$/;

/** Nombre minimal de pages analysées pour juger la couverture des questions des prospects. */
const MIN_PAGES_FOR_T2 = 3;

export const T1: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const offerPages = view.okPages.filter((p) => p.role === "offer");
  if (offerPages.length > 0) {
    const withH1 = offerPages.filter((p) => p.analysis.facts.h1.length > 0);
    const evidence = offerPages.slice(0, 3).map((p) => ({ url: p.analysis.finalUrl, label: "Page d'offre analysée", excerpt: p.analysis.facts.h1[0] }));
    if (withH1.length === offerPages.length) return pass(`${offerPages.length} page(s) d'offre analysée(s), chacune avec son titre principal.`, evidence, "MEDIUM");
    return partial(share(withH1.length, offerPages.length), "Des pages d'offre existent mais certaines n'ont pas de titre principal.", ["Un titre principal sur chaque page d'offre"], evidence, "MEDIUM");
  }
  const links = findLinks(view.home.facts.internalLinks, LINK_KINDS.offer);
  if (links.length > 0) {
    return pass(`La page d'accueil renvoie vers ${links.length} page(s) d'offre (contenu de ces pages non analysé dans cette version).`, linkEvidence(links, "Lien vers une offre"), "MEDIUM");
  }
  return fail("Aucun lien vers une page d'offre (offres, services, solutions, formations…) n'a été trouvé depuis l'accueil.", ["Une page par offre principale, reliée depuis le menu"], [homeEvidence(view, "Liens de la page d'accueil analysés")], "MEDIUM");
};

export const T2: Rule = (view) => {
  const queries = view.input.context.geoQueries;
  if (queries.length === 0) return notApplicable("Sans objet : aucune question de prospect n'a été renseignée dans le projet.");
  if (view.okPages.length < MIN_PAGES_FOR_T2) {
    return notVerified(`Non vérifié : il faut analyser au moins ${MIN_PAGES_FOR_T2} pages pour savoir si vos questions ont une page dédiée (${view.okPages.length} analysée(s)).`);
  }
  const covered: string[] = [];
  const uncovered: string[] = [];
  const evidence = [];
  for (const query of queries) {
    const qTerms = terms(query);
    const page = view.okPages.find((p) => {
      const f = p.analysis.facts;
      const found = matchedTerms(qTerms, `${f.title ?? ""} ${f.h1.join(" ")} ${f.h2.join(" ")}`);
      return qTerms.length > 0 && found.length / qTerms.length >= 0.5;
    });
    if (page) {
      covered.push(query);
      evidence.push({ url: page.analysis.finalUrl, label: "Page qui répond à la question", excerpt: query });
    } else {
      uncovered.push(query);
    }
  }
  if (uncovered.length === 0) return pass(`Chacune de vos ${queries.length} question(s) a une page dont les titres reprennent les mots.`, evidence, "MEDIUM");
  if (covered.length > 0) return partial(share(covered.length, queries.length), `${covered.length} question(s) sur ${queries.length} ont une page dédiée.`, uncovered.map((q) => `Page pour : « ${q} »`), evidence, "MEDIUM");
  return fail("Aucune des pages analysées ne reprend les mots de vos questions prioritaires dans ses titres.", uncovered.map((q) => `Page pour : « ${q} »`), [], "MEDIUM");
};

export const T3: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const proofs = view.okPages.flatMap((p) => p.analysis.facts.proofs.map((proof) => ({ ...proof, url: p.analysis.finalUrl })));
  const types = [...new Set(proofs.map((p) => p.type))];
  const evidence = types.map((t) => {
    const first = proofs.find((p) => p.type === t)!;
    return { url: first.url, label: `Preuve : ${PROOF_LABELS[t]}`, excerpt: first.excerpt };
  });
  const absent = (Object.keys(PROOF_LABELS) as ProofType[]).filter((t) => !types.includes(t)).map((t) => PROOF_LABELS[t]);
  const found = types.map((t) => PROOF_LABELS[t]).join(", ");
  if (types.length >= 3) return pass(`${types.length} types de preuves repérés : ${found}.`, evidence, "MEDIUM");
  if (types.length === 2) return partial(0.7, `2 types de preuves repérés (${found}) ; l'objectif est d'en montrer au moins 3.`, absent, evidence, "MEDIUM");
  if (types.length === 1) return partial(0.4, `Un seul type de preuve repéré (${found}).`, absent, evidence, "MEDIUM");
  return fail("Aucune preuve repérée : ni témoignage, ni logo client, ni étude de cas, ni chiffre de résultat.", absent, [homeEvidence(view, "Pages analysées sans preuve repérée")], "MEDIUM");
};

export const T4: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const ctas = view.home.facts.ctas;
  const top = ctas.filter((c) => c.position === "top");
  const explicitTop = top.filter((c) => !GENERIC_CTA.test(normalize(c.text)));
  const evidence = (explicitTop.length ? explicitTop : ctas).slice(0, 3).map((c) => ({ url: c.href ?? view.home?.finalUrl, label: c.position === "top" ? "Bouton en haut de page" : "Bouton plus bas", excerpt: c.text }));
  if (explicitTop.length > 0) return pass(`Un bouton d'action explicite est placé en haut de la page : « ${explicitTop[0].text} ».`, evidence, "MEDIUM");
  if (top.length > 0) return partial(0.5, `Le bouton en haut de la page a un libellé vague (« ${top[0].text} »).`, ["Un libellé d'action explicite"], evidence, "MEDIUM");
  if (ctas.length > 0) return partial(0.5, "Des boutons d'action existent, mais aucun dans le haut de la page.", ["Un bouton d'action en haut de la page"], evidence, "MEDIUM");
  return fail("Aucun bouton ou lien d'action n'a été repéré sur la page d'accueil.", ["Un bouton d'action en haut de la page"], [homeEvidence(view, "Page d'accueil")], "MEDIUM");
};

export const T5: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const links = view.home.facts.internalLinks;
  const offer = findLinks(links, LINK_KINDS.offer);
  const contact = findLinks(links, LINK_KINDS.contact);
  const evidence = [...linkEvidence(offer, "Lien vers les offres"), ...linkEvidence(contact, "Lien vers le contact")];
  const missing = [...(offer.length ? [] : ["Lien vers les offres"]), ...(contact.length ? [] : ["Lien vers la page contact"])];
  const note = " La taille du menu n'est pas mesurée dans cette version.";
  if (missing.length === 0) return pass(`Offres et contact sont à un clic de l'accueil.${note}`, evidence, "MEDIUM");
  if (missing.length === 1) return partial(0.5, `Il manque depuis l'accueil : ${missing[0].toLowerCase()}.${note}`, missing, evidence, "MEDIUM");
  return fail(`Ni les offres ni le contact ne sont reliés depuis la page d'accueil.${note}`, missing, evidence, "MEDIUM");
};

export const T6: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const aboutLinks = findLinks(view.internalLinks, LINK_KINDS.about);
  const aboutPage = view.okPages.find((p) => p.role === "about");
  const persons = view.okPages.flatMap((p) => p.analysis.facts.jsonLd).filter((b) => b.valid && b.types.includes("Person"));
  const evidence = [
    ...linkEvidence(aboutLinks, "Lien « À propos »"),
    ...(aboutPage ? [{ url: aboutPage.analysis.finalUrl, label: "Page « À propos » analysée" }] : []),
    ...(persons.length ? [homeEvidence(view, "Personne déclarée en données structurées (Person)")] : []),
  ];
  const hasAbout = aboutLinks.length > 0 || Boolean(aboutPage);
  const hasPerson = persons.length > 0;
  if (hasAbout && hasPerson) return pass("Une page « À propos » existe et au moins une personne est identifiée.", evidence, "MEDIUM");
  if (hasAbout || hasPerson) {
    return partial(
      0.5,
      hasAbout
        ? "Une page « À propos » existe ; aucune personne n'est déclarée en données structurées (les noms dans le texte ne sont pas vérifiés automatiquement)."
        : "Une personne est déclarée, mais aucune page « À propos » n'est reliée.",
      hasAbout ? ["Fondateur ou équipe déclarés (données structurées Person)"] : ["Une page « À propos » reliée depuis l'accueil"],
      evidence,
      "LOW",
    );
  }
  return fail("Aucune page « À propos » ni personne identifiée n'a été trouvée.", ["Une page « À propos » avec l'équipe ou le fondateur"], [homeEvidence(view, "Liens de la page d'accueil analysés")], "MEDIUM");
};
