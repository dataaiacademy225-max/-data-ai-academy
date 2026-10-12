import type { CrawlError, LinkFact, PageFacts, UrlAnalysis } from "@/server/crawler/types";
import { normalize, truncate } from "@/server/scoring/text";
import type { Confidence, Evidence, Outcome, PageRole, Priority, ScoringInput } from "@/server/scoring/types";

/** Vue pré-calculée du site, partagée par toutes les règles (calculée une fois). */
export type SiteView = {
  input: ScoringInput;
  home: UrlAnalysis | null;
  /** Raison pour laquelle la page d'accueil n'a pas pu être analysée. */
  homeError: CrawlError | null;
  okPages: { role: PageRole; url: string; analysis: UrlAnalysis }[];
  /** Zone « héro » approximée : H1 + premiers mots qui le suivent dans le texte visible. */
  heroText: string;
  /** Texte visible échantillonné de toutes les pages analysées. */
  allText: string;
  internalLinks: LinkFact[];
  externalLinks: LinkFact[];
};

export type Rule = (view: SiteView) => Outcome;

const HERO_WORDS = 90;

function heroOf(facts: PageFacts): string {
  const excerpt = facts.visibleText.excerpt;
  const h1 = facts.h1[0];
  const words = (text: string) => text.split(" ").slice(0, HERO_WORDS).join(" ");
  if (h1) {
    const at = excerpt.indexOf(h1);
    return at >= 0 ? words(excerpt.slice(at)) : `${h1} ${words(excerpt)}`;
  }
  return words(excerpt);
}

export function buildView(input: ScoringInput): SiteView {
  const okPages = input.pages.flatMap((p) => (p.ok ? [{ role: p.role, url: p.url, analysis: p.analysis }] : []));
  const homeInput = input.pages.find((p) => p.role === "home");
  const home = homeInput?.ok ? homeInput.analysis : null;
  return {
    input,
    home,
    homeError: homeInput && !homeInput.ok ? homeInput.error : null,
    okPages,
    heroText: home ? heroOf(home.facts) : "",
    allText: okPages.map((p) => p.analysis.facts.visibleText.sample).join(" "),
    internalLinks: okPages.flatMap((p) => p.analysis.facts.internalLinks),
    externalLinks: okPages.flatMap((p) => p.analysis.facts.externalLinks),
  };
}

// ─── Constructeurs de résultats ───────────────────────────────────

export const pass = (explanation: string, evidence: Evidence[] = [], confidence: Confidence = "HIGH"): Outcome => ({
  status: "PASS",
  ratio: 1,
  confidence,
  explanation,
  evidence,
  missing: [],
});

export const partial = (
  ratio: number,
  explanation: string,
  missing: string[],
  evidence: Evidence[] = [],
  confidence: Confidence = "HIGH",
  priority?: Priority,
): Outcome => ({
  status: "PARTIAL",
  ratio: Math.min(0.9, Math.max(0.1, ratio)),
  confidence,
  explanation,
  evidence,
  missing,
  priority,
});

export const fail = (
  explanation: string,
  missing: string[],
  evidence: Evidence[] = [],
  confidence: Confidence = "HIGH",
  priority?: Priority,
): Outcome => ({ status: "FAIL", ratio: 0, confidence, explanation, evidence, missing, priority });

export const notVerified = (explanation: string): Outcome => ({ status: "NOT_VERIFIED", explanation });
export const notApplicable = (explanation: string): Outcome => ({ status: "NOT_APPLICABLE", explanation });

const ERROR_REASONS: Record<CrawlError["code"], string> = {
  INVALID_URL: "l'adresse du site est invalide",
  BLOCKED_PRIVATE: "l'adresse pointe vers un réseau privé ou interne",
  DNS_ERROR: "le nom de domaine est introuvable",
  NETWORK_ERROR: "la connexion au site a échoué",
  TIMEOUT: "le site n'a pas répondu à temps",
  TOO_LARGE: "la page dépasse la taille maximale analysée",
  TOO_MANY_REDIRECTS: "la page redirige trop de fois",
  HTTP_ERROR: "le site a répondu par une erreur",
  NOT_HTML: "la page n'est pas une page web HTML",
  ROBOTS_DISALLOWED: "le fichier robots.txt du site interdit ou empêche l'analyse",
};

/** Codes HTTP qui signalent un refus d'accès au robot, pas une panne du site. */
export function isAccessDenied(status: number | undefined): boolean {
  return status === 401 || status === 403 || status === 429;
}

export function errorReason(error: CrawlError): string {
  if (error.code === "HTTP_ERROR" && isAccessDenied(error.httpStatus)) {
    return `le site a refusé l'accès à notre robot d'analyse (code HTTP ${error.httpStatus}), probablement une protection anti-robot ou une limite de requêtes ; un visiteur peut voir la page normalement`;
  }
  const base = ERROR_REASONS[error.code];
  return error.httpStatus ? `${base} (code HTTP ${error.httpStatus})` : base;
}

/**
 * Le texte de la page d'accueil est-il lisible dans le code reçu ?
 * Non si le contenu est affiché par JavaScript : on ne peut alors rien conclure sur ce contenu.
 */
export function contentUnreadable(view: SiteView): Outcome | null {
  if (!view.home) return homeNotVerified(view);
  if (view.home.facts.likelyClientRendered) {
    return notVerified("Non vérifié : le contenu de la page d'accueil est affiché par JavaScript et n'a pas pu être lu. Rien n'est conclu sur ce contenu.");
  }
  return null;
}

/** Résultat « non vérifié » standard quand la page d'accueil manque. */
export function homeNotVerified(view: SiteView): Outcome {
  return notVerified(
    view.homeError
      ? `Non vérifié : la page d'accueil n'a pas pu être analysée car ${errorReason(view.homeError)}.`
      : "Non vérifié : la page d'accueil n'a pas été analysée.",
  );
}

export const homeEvidence = (view: SiteView, label: string, excerpt?: string): Evidence => ({
  url: view.home?.finalUrl,
  label,
  excerpt: excerpt ? truncate(excerpt) : undefined,
});

// ─── Repérage de liens par leur texte ou leur adresse ────────────

export const LINK_KINDS = {
  offer: /\b(offres?|services?|solutions?|prestations?|accompagnements?|formations?|expertises?|tarifs?|pricing|produits?|products?)\b/,
  about: /\b(a propos|about|qui sommes nous|equipe|team|notre histoire|fondat\w*|founder)\b/,
  contact: /\b(contact\w*|nous joindre|rendez vous|rdv)\b/,
  legal: /\b(mentions legales|confidentialite|privacy|rgpd|gdpr|cgu|cgv|legal|donnees personnelles)\b/,
} as const;

export function linkMatches(link: LinkFact, pattern: RegExp): boolean {
  let path = "";
  try {
    path = new URL(link.url).pathname;
  } catch {
    // lien déjà validé par le crawler ; par prudence on ignore le chemin
  }
  return pattern.test(normalize(`${link.text} ${path}`));
}

export function findLinks(links: LinkFact[], pattern: RegExp): LinkFact[] {
  return links.filter((l) => linkMatches(l, pattern));
}

export const linkEvidence = (links: LinkFact[], label: string): Evidence[] =>
  links.slice(0, 3).map((l) => ({ url: l.url, label, excerpt: l.text || undefined }));

/** Proportion arrondie, utilisée pour les critères mesurés page par page. */
export function share(ok: number, total: number): number {
  return total === 0 ? 0 : ok / total;
}
