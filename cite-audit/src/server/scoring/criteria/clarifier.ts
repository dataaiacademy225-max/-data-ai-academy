import { containsPhrase, matchedTerms, normalize, terms, truncate } from "@/server/scoring/text";
import {
  contentUnreadable,
  fail,
  homeEvidence,
  homeNotVerified,
  notVerified,
  partial,
  pass,
  type Rule,
} from "@/server/scoring/criteria/shared";

const GENERIC_H1 = /^(bienvenue|accueil|home|welcome|bonjour|hello)\b/;

/** Vocabulaire générique d'offre de services B2B (complète les mots du secteur déclaré). */
const OFFER_WORDS = terms(
  "conseil consultant cabinet agence accompagnement formation formations audit logiciel plateforme solution solutions " +
    "service services expert expertise prestations studio developpement strategie coaching saas outil application " +
    "consulting agency software training",
);

const BENEFIT =
  /\b(aid\w*|permet\w*|gagn\w*|augment\w*|redui\w*|amelior\w*|develop\w*|acceler\w*|optimis\w*|simplifi\w*|automatis\w*|economis\w*|trouv\w*|obten\w*|attir\w*|convert\w*|securis\w*|croissance|resultats?|rentab\w*|sans|grace|help\w*|grow\w*|boost\w*|save\w*|increase\w*)\b|\d+\s?%/;

export const C1: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const h1s = view.home.facts.h1;
  if (h1s.length === 0) {
    return fail("Aucun titre principal (H1) n'a été trouvé sur la page d'accueil.", ["Un titre principal H1"], [homeEvidence(view, "Page d'accueil analysée")]);
  }
  const h1 = h1s[0];
  const evidence = [homeEvidence(view, "Titre principal (H1)", h1)];
  const words = h1.split(/\s+/).length;
  const onlyCompany = normalize(h1) === normalize(view.input.context.companyName);
  if (h1s.length > 1) {
    return partial(0.6, `La page d'accueil contient ${h1s.length} titres principaux (H1) au lieu d'un seul.`, ["Un seul H1 par page"], h1s.slice(0, 3).map((t) => homeEvidence(view, "H1", t)));
  }
  if (GENERIC_H1.test(normalize(h1)) || onlyCompany || words < 3 || words > 15) {
    const why = onlyCompany
      ? "il reprend seulement le nom de l'entreprise"
      : words < 3
        ? "il est très court"
        : words > 15
          ? `il est long (${words} mots)`
          : "il est générique";
    return partial(0.4, `Un titre principal existe, mais ${why} : il ne dit pas clairement ce que vous faites.`, ["Un H1 de 3 à 15 mots qui nomme l'offre"], evidence);
  }
  return pass(`Un seul titre principal, de ${words} mots : « ${truncate(h1, 80)} ».`, evidence);
};

export const C2: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const hero = view.heroText;
  if (!hero) return notVerified("Non vérifié : aucun texte visible en haut de la page d'accueil.");
  const sectorTerms = terms(view.input.context.sector);
  const sectorFound = matchedTerms(sectorTerms, hero);
  const evidence = [homeEvidence(view, "Haut de la page d'accueil", hero)];
  if (sectorFound.length > 0) {
    return pass(`Le haut de la page reprend les mots de votre secteur : ${sectorFound.join(", ")}.`, evidence, "MEDIUM");
  }
  const generic = matchedTerms(OFFER_WORDS, hero);
  if (generic.length > 0) {
    return partial(0.5, `Le haut de la page parle d'une offre (${generic.slice(0, 3).join(", ")}) sans reprendre les mots de votre secteur déclaré (« ${view.input.context.sector} »).`, [`Les mots de votre secteur : ${sectorTerms.join(", ")}`], evidence, "MEDIUM");
  }
  return fail("Le haut de la page d'accueil ne nomme pas d'offre reconnaissable.", [`Les mots de votre secteur : ${sectorTerms.join(", ")}`], evidence, "MEDIUM");
};

export const C3: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const targetTerms = terms(view.input.context.primaryTarget);
  if (targetTerms.length === 0) return notVerified("Non vérifié : la cible déclarée ne contient pas de mot exploitable.");
  const inHero = matchedTerms(targetTerms, view.heroText);
  const evidence = [homeEvidence(view, "Haut de la page d'accueil", view.heroText)];
  if (inHero.length > 0) {
    return pass(`Votre cible est évoquée en haut de page (${inHero.join(", ")}).`, evidence, "MEDIUM");
  }
  const facts = view.home.facts;
  const lower = `${facts.h2.join(" ")} ${facts.metaDescription ?? ""} ${facts.visibleText.sample}`;
  const below = matchedTerms(targetTerms, lower);
  if (below.length > 0) {
    return partial(0.5, `Votre cible (${below.join(", ")}) est citée, mais plus bas dans la page, pas dans la zone lue en premier.`, ["La cible citée dans le haut de la page"], evidence, "MEDIUM");
  }
  return fail(`Votre cible déclarée (« ${view.input.context.primaryTarget} ») n'apparaît pas sur la page d'accueil.`, [`Mots attendus : ${targetTerms.join(", ")}`], evidence, "MEDIUM");
};

export const C4: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  if (!view.heroText) return notVerified("Non vérifié : aucun texte visible en haut de la page d'accueil.");
  const evidence = [homeEvidence(view, "Haut de la page d'accueil", view.heroText)];
  const match = BENEFIT.exec(normalize(view.heroText));
  if (match) {
    return pass(`Le haut de la page exprime un bénéfice ou un résultat (ex. « ${match[0]} »).`, evidence, "LOW");
  }
  return fail("Aucune formulation de bénéfice ou de résultat n'a été repérée dans le haut de la page.", ["Une phrase qui décrit le résultat obtenu par vos clients"], evidence, "LOW");
};

export const C5: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const { title, metaDescription, h1 } = view.home.facts;
  const reference = h1[0] ?? title;
  if (!reference) {
    return fail("Ni titre de page ni titre principal : impossible d'aligner le message.", ["Balise title", "Titre principal H1"], [homeEvidence(view, "Page d'accueil")]);
  }
  const refTerms = terms(reference);
  const checks = [
    { name: "titre de la page", text: title, skip: !h1[0] },
    { name: "description", text: metaDescription, skip: false },
  ].filter((c) => !c.skip);
  const missing: string[] = [];
  let aligned = 0;
  for (const check of checks) {
    if (!check.text) missing.push(`La ${check.name} est absente`);
    else if (matchedTerms(refTerms, check.text).length > 0) aligned += 1;
    else missing.push(`La ${check.name} ne reprend aucun mot du titre principal`);
  }
  const evidence = [
    homeEvidence(view, "Titre principal (H1)", h1[0]),
    homeEvidence(view, "Titre de la page (title)", title ?? "absent"),
    homeEvidence(view, "Description (meta description)", metaDescription ?? "absente"),
  ];
  if (aligned === checks.length) return pass("Le titre de la page, la description et le titre principal partagent les mêmes mots-clés.", evidence);
  if (aligned > 0) return partial(0.5, "Le message n'est aligné qu'en partie entre titre de page, description et titre principal.", missing, evidence);
  return fail("Le titre de la page, la description et le titre principal ne disent pas la même chose.", missing, evidence);
};

export const C6: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const text = view.home.facts.visibleText.excerpt;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 30) return notVerified("Non vérifié : pas assez de texte en haut de page pour mesurer la lisibilité.");
  const sentences = text.split(/[.!?…]+\s/).filter((s) => s.trim().split(/\s+/).length >= 3);
  const average = Math.round(words / Math.max(1, sentences.length));
  const evidence = [homeEvidence(view, `Longueur moyenne des phrases : ${average} mots`, text)];
  if (average <= 20) return pass(`Les phrases du haut de page comptent en moyenne ${average} mots.`, evidence, "MEDIUM");
  if (average <= 28) return partial(0.5, `Les phrases du haut de page comptent en moyenne ${average} mots (objectif : 20 maximum).`, ["Des phrases de 20 mots maximum"], evidence, "MEDIUM");
  return fail(`Les phrases du haut de page sont longues : ${average} mots en moyenne (objectif : 20 maximum).`, ["Des phrases de 20 mots maximum"], evidence, "MEDIUM");
};

/** Vrai si le nom de l'entreprise figure dans le texte (comparaison sans accents ni casse). */
export const mentionsCompany = (text: string, company: string) => containsPhrase(text, company);
