import type { Effort, Pillar, Priority, Recommendation, ScoringResult } from "@/server/scoring/types";

/**
 * Présentation du rapport pour un dirigeant (fonctions pures, testées).
 * Ne modifie pas le score CITE : réorganise seulement ce qui est affiché, pour répondre à deux questions :
 * « Pourquoi mon site est-il peu visible ? » et « Que corriger en priorité ? ».
 * Fonctionne aussi avec les rapports déjà enregistrés (aucun champ nouveau n'est lu dans le rapport).
 */

/** Qui réalise l'action : permet au dirigeant de déléguer. */
export type Owner = "YOU" | "CONTENT" | "WEB";

export const OWNER_LABEL: Record<Owner, string> = {
  YOU: "Vous (dirigeant)",
  CONTENT: "Vous ou un rédacteur",
  WEB: "Votre prestataire web",
};

/** Deux questions distinctes : être trouvé et compris, puis transformer les visites en contacts. */
export type GroupId = "FOUND" | "CONVERT";

export const GROUPS: Record<GroupId, { title: string; question: string; pillars: Pillar[] }> = {
  FOUND: {
    title: "Être trouvé et compris",
    question: "Google et les IA peuvent-ils lire votre site et comprendre ce que vous faites ?",
    pillars: ["CLARIFIER", "INDEXER"],
  },
  CONVERT: {
    title: "Transformer les visites en contacts",
    question: "Un visiteur intéressé trouve-t-il des preuves et un moyen simple de vous contacter ?",
    pillars: ["TUNNEL", "ENCLENCHER"],
  },
};

const PILLAR_GROUP: Record<Pillar, GroupId> = { CLARIFIER: "FOUND", INDEXER: "FOUND", TUNNEL: "CONVERT", ENCLENCHER: "CONVERT" };

/**
 * Pour chaque critère : qui s'en charge, et le frein en une expression simple (utilisée dans le diagnostic).
 * Formulations valables que le critère soit partiel ou en échec.
 */
export const CRITERION_META: Record<string, { owner: Owner; issue: string }> = {
  C1: { owner: "CONTENT", issue: "votre titre principal ne dit pas assez clairement ce que vous faites" },
  C2: { owner: "YOU", issue: "votre offre n'est pas assez visible en haut de la page d'accueil" },
  C3: { owner: "YOU", issue: "la cible que vous visez n'est pas assez clairement nommée" },
  C4: { owner: "YOU", issue: "le résultat que vous apportez à vos clients n'est pas assez exprimé" },
  C5: { owner: "CONTENT", issue: "le titre de l'onglet, la description et le titre principal ne disent pas la même chose" },
  C6: { owner: "CONTENT", issue: "les phrases du haut de page sont longues ou difficiles à lire" },
  I1: { owner: "WEB", issue: "votre page d'accueil ne répond pas correctement ou ne peut pas être indexée" },
  I2: { owner: "WEB", issue: "le fichier robots.txt manque ou bloque la lecture du site" },
  I3: { owner: "WEB", issue: "le plan du site destiné aux moteurs manque ou est incomplet" },
  I4: { owner: "WEB", issue: "les titres de vos pages dans Google sont absents ou mal calibrés" },
  I5: { owner: "WEB", issue: "les descriptions de vos pages dans Google sont absentes ou mal calibrées" },
  I6: { owner: "WEB", issue: "vos pages manquent de titres et de sous-titres structurés" },
  I7: { owner: "WEB", issue: "vos pages n'indiquent pas toutes leur adresse de référence" },
  I8: { owner: "WEB", issue: "une partie de votre texte n'est lisible qu'avec JavaScript, donc difficile à lire pour les robots" },
  I9: { owner: "WEB", issue: "votre site ne fournit pas de fiche d'identité lisible par les machines" },
  I10: { owner: "WEB", issue: "l'aperçu de vos pages lors d'un partage n'est pas renseigné" },
  I11: { owner: "WEB", issue: "vos images ne sont pas toutes décrites par un texte" },
  I12: { owner: "WEB", issue: "la page d'accueil renvoie peu vers vos autres pages importantes" },
  I13: { owner: "YOU", issue: "votre nom et votre ville n'apparaissent pas de façon cohérente" },
  I14: { owner: "WEB", issue: "votre page s'affiche lentement" },
  T1: { owner: "CONTENT", issue: "vos offres n'ont pas de page dédiée facile à trouver" },
  T2: { owner: "CONTENT", issue: "les questions de vos prospects n'ont pas toutes une page qui y répond" },
  T3: { owner: "YOU", issue: "votre site montre peu de preuves de vos résultats" },
  T4: { owner: "WEB", issue: "aucun bouton d'action clair n'apparaît en haut de la page d'accueil" },
  T5: { owner: "WEB", issue: "vos offres et votre contact ne sont pas tous à un clic de l'accueil" },
  T6: { owner: "YOU", issue: "le site présente peu l'équipe ou le fondateur" },
  E1: { owner: "WEB", issue: "vos coordonnées sont peu visibles depuis l'accueil" },
  E2: { owner: "WEB", issue: "un prospect ne peut pas facilement envoyer une demande ou réserver un rendez-vous" },
  E3: { owner: "WEB", issue: "l'action principale n'est pas reproposée plus bas dans la page" },
  E4: { owner: "YOU", issue: "aucune première étape simple (diagnostic, démo, guide, devis) n'est mise en avant" },
  E5: { owner: "CONTENT", issue: "le site rassure peu avant le contact (confidentialité, délai de réponse)" },
  E6: { owner: "YOU", issue: "peu d'autres moyens de vous joindre sont proposés (WhatsApp, LinkedIn, téléphone)" },
};

const FALLBACK_META = { owner: "WEB" as Owner, issue: "un point technique est à corriger" };
export const metaFor = (code: string) => CRITERION_META[code] ?? FALLBACK_META;

const PRIORITY_RANK: Record<Priority, number> = { CRITIQUE: 0, IMPORTANT: 1, RECOMMANDE: 2 };
const EFFORT_RANK: Record<Effort, number> = { faible: 0, moyen: 1, élevé: 2 };

/**
 * Ordre des actions :
 * 1. gravité (critique, puis important, puis recommandé) ;
 * 2. à gravité égale, ce qui aide à être trouvé et compris passe avant la conversion ;
 * 3. puis l'effort le plus faible d'abord (gains rapides) ;
 * 4. puis l'écart le plus grand sur le critère.
 */
export function rankRecommendations(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (PILLAR_GROUP[a.pillar] === "FOUND" ? 0 : 1) - (PILLAR_GROUP[b.pillar] === "FOUND" ? 0 : 1) ||
      EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort] ||
      b.pointsAtStake - a.pointsAtStake ||
      a.criterionCode.localeCompare(b.criterionCode),
  );
}

export type GroupView = {
  id: GroupId;
  title: string;
  question: string;
  /** Part des points obtenus sur les piliers du groupe, null si un pilier n'est pas noté. */
  ratio: number | null;
  /** Les 3 actions à faire en premier pour ce groupe. */
  top: Recommendation[];
  /** Toutes les actions du groupe, réparties entre celles que le dirigeant pilote et celles du prestataire web. */
  ownActions: Recommendation[];
  webActions: Recommendation[];
};

export type ReportView = {
  diagnosis: string[];
  groups: GroupView[];
  notMeasured: string[];
};

function groupRatio(report: ScoringResult, id: GroupId): number | null {
  let score = 0;
  let max = 0;
  for (const p of GROUPS[id].pillars) {
    const pillar = report.pillars[p];
    if (pillar.score === null) return null;
    score += pillar.score;
    max += pillar.maxPoints;
  }
  return max > 0 ? score / max : null;
}

const joinIssues = (issues: string[]) => (issues.length > 1 ? `${issues[0]}, et ${issues[1]}` : issues[0]);

const OFF_SITE =
  "Ce rapport ne regarde que votre site : votre réputation ailleurs (fiche Google, avis, articles, annuaires, LinkedIn) peut aussi expliquer une faible visibilité.";

function groupSentence(id: GroupId, ratio: number | null, top: Recommendation[]): string {
  const issues = top.slice(0, 2).map((r) => metaFor(r.criterionCode).issue);
  const blocking = top.some((r) => r.priority === "CRITIQUE");
  if (id === "FOUND") {
    if (ratio === null) return "Nous n'avons pas pu mesurer assez d'éléments pour dire si votre site est bien lu et bien compris : voir la section « Limites ».";
    if (issues.length === 0 || (ratio >= 0.8 && !blocking)) {
      return "Côté visibilité, les bases sont en place : votre site est lisible et votre activité est clairement expliquée.";
    }
    return `Ce qui freine le plus votre visibilité : ${joinIssues(issues)}.`;
  }
  if (ratio === null) return "Nous n'avons pas pu mesurer assez d'éléments pour juger le parcours jusqu'au contact : voir la section « Limites ».";
  if (issues.length === 0 || (ratio >= 0.8 && !blocking)) {
    return "Côté contact, un visiteur intéressé trouve des preuves et un moyen simple de vous joindre.";
  }
  return `Ce qui freine la transformation des visites en contacts : ${joinIssues(issues)}.`;
}

function pagesBeyond(analyzed: number): string {
  if (analyzed <= 1) return "Les autres pages de votre site : une seule page a pu être analysée lors de cet audit.";
  return `Les autres pages de votre site : ${analyzed} pages ont été analysées lors de cet audit, pas la totalité du site.`;
}

/** Ce que l'audit ne mesure pas, toujours affiché : évite de présenter le score comme une mesure de visibilité globale. */
function notMeasuredList(report: ScoringResult): string[] {
  const list = [
    "Votre réputation hors de votre site : fiche Google (Google Business Profile), avis clients, articles et annuaires qui parlent de vous, profils LinkedIn.",
    "Vos positions réelles dans Google et votre trafic : seules vos propres données (Google Search Console, statistiques du site) peuvent les montrer.",
    pagesBeyond(report.analyzedPages.filter((p) => p.ok).length),
    "Ce que répondent les IA à vos prospects : c'est l'objet du module séparé « Visibilité IA », sur un échantillon de questions.",
  ];
  if (report.notVerified.some((n) => n.code === "I14")) list.splice(2, 0, "La vitesse d'affichage de vos pages (non mesurée dans cette version).");
  return list;
}

export function buildReportView(report: ScoringResult): ReportView {
  const ranked = rankRecommendations(report.recommendations);
  const groups = (["FOUND", "CONVERT"] as GroupId[]).map((id): GroupView => {
    const recs = ranked.filter((r) => PILLAR_GROUP[r.pillar] === id);
    return {
      id,
      title: GROUPS[id].title,
      question: GROUPS[id].question,
      ratio: groupRatio(report, id),
      top: recs.slice(0, 3),
      ownActions: recs.filter((r) => metaFor(r.criterionCode).owner !== "WEB"),
      webActions: recs.filter((r) => metaFor(r.criterionCode).owner === "WEB"),
    };
  });

  const nothingMeasured = report.coverage === 0;
  const diagnosis = nothingMeasured
    ? ["Nous n'avons pas pu analyser votre site : la raison est indiquée dans la section « Limites ».", OFF_SITE]
    : [...groups.map((g) => groupSentence(g.id, g.ratio, g.top)), OFF_SITE];

  return { diagnosis, groups, notMeasured: notMeasuredList(report) };
}
