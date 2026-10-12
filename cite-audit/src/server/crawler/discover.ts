import type { LinkFact, PageRole } from "@/server/crawler/types";

/**
 * Choix des pages à analyser à partir des liens de l'accueil et du plan du site. Fonction pure.
 * Priorité aux pages utiles à l'audit (contact, à propos, offres, références), dans la limite fixée.
 */

export const DEFAULT_MAX_PAGES = 15;

/** Nombre maximal de pages par rôle (l'accueil est toujours analysé en plus). */
const QUOTAS: Record<Exclude<PageRole, "home">, number> = {
  contact: 1,
  about: 1,
  offer: 5,
  case_study: 2,
  faq: 1,
  blog: 2,
  other: 14,
};
const ROLE_ORDER: Exclude<PageRole, "home">[] = ["contact", "about", "offer", "case_study", "faq", "blog", "other"];

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ROLE_PATTERNS: [Exclude<PageRole, "home" | "other">, RegExp][] = [
  ["contact", /\b(contact\w*|nous joindre|rendez vous|rdv|devis)\b/],
  ["about", /\b(a propos|about|qui sommes nous|equipe|team|notre histoire|fondat\w*|founder|cabinet|agence)\b/],
  ["case_study", /\b(etudes? de cas|cas clients?|case stud\w*|success stor\w*|realisations?|references?|portfolio|temoignages?|clients)\b/],
  ["faq", /\b(faq|questions? frequentes?|aide|help)\b/],
  ["offer", /\b(offres?|services?|solutions?|prestations?|accompagnements?|formations?|expertises?|tarifs?|pricing|produits?|products?|missions?|conseil)\b/],
  ["blog", /\b(blog|articles?|actualites?|news|ressources?|insights?|guides?)\b/],
];

const EXCLUDED_PATH =
  /\/(wp-admin|wp-login|wp-json|login|connexion|signin|sign-in|logout|deconnexion|register|inscription|panier|cart|checkout|commande|compte|account|my-account|feed|rss|tag|tags|category|categorie|author|auteur|search|recherche|cdn-cgi)(\/|\.|$)|\/page\/\d+\/?$/i;
const FILE_EXTENSION = /\.(pdf|jpe?g|png|gif|svg|webp|avif|ico|zip|rar|7z|docx?|xlsx?|pptx?|csv|mp4|mp3|mov|avi|xml|txt|json|css|js|woff2?|ttf)$/i;
const LEGAL_PATH = /(mentions[- ]legales|confidentialite|privacy|cookies?|cgu|cgv|legal|rgpd|gdpr|terms|conditions)/i;

const hostKey = (host: string) => host.toLowerCase().replace(/^www\./, "");

/** Adresse canonique de comparaison : sans ancre ni paramètres, sans « / » final. */
export function pageKey(url: URL): string {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `${hostKey(url.hostname)}${path}`;
}

export function classifyPage(url: URL, linkText = ""): Exclude<PageRole, "home"> {
  const haystack = normalize(`${linkText} ${decodeURIComponent(url.pathname).replace(/[/_-]+/g, " ")}`);
  for (const [role, pattern] of ROLE_PATTERNS) {
    if (pattern.test(haystack)) return role;
  }
  return "other";
}

export type Candidate = { url: string; role: Exclude<PageRole, "home">; source: "home" | "sitemap" };

/**
 * @param homeUrl  URL finale de la page d'accueil (après redirections)
 * @param homeLinks  liens internes de l'accueil, dans l'ordre de la page
 * @param sitemapUrls  adresses du plan du site (même domaine)
 * @param maxPages  total de pages analysées, accueil compris
 */
export function selectPages(homeUrl: string, homeLinks: LinkFact[], sitemapUrls: string[], maxPages = DEFAULT_MAX_PAGES): Candidate[] {
  const home = new URL(homeUrl);
  const seen = new Set<string>([pageKey(home)]);
  const byRole = new Map<Exclude<PageRole, "home">, Candidate[]>(ROLE_ORDER.map((r) => [r, []]));

  const consider = (raw: string, text: string, source: Candidate["source"]) => {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (hostKey(url.hostname) !== hostKey(home.hostname)) return;
    if (EXCLUDED_PATH.test(url.pathname) || FILE_EXTENSION.test(url.pathname) || LEGAL_PATH.test(url.pathname)) return;
    const key = pageKey(url);
    if (seen.has(key)) return;
    seen.add(key);
    url.hash = "";
    url.search = "";
    const role = classifyPage(url, text);
    byRole.get(role)!.push({ url: url.toString(), role, source });
  };

  for (const link of homeLinks) consider(link.url, link.text, "home");
  for (const url of sitemapUrls) consider(url, "", "sitemap");

  // Pour les pages sans rôle précis, les adresses courtes (pages de premier niveau) d'abord.
  byRole.get("other")!.sort((a, b) => new URL(a.url).pathname.split("/").length - new URL(b.url).pathname.split("/").length);

  const budget = Math.max(0, maxPages - 1);
  const selected: Candidate[] = [];
  // 1er passage : quotas par rôle, pour couvrir tout le parcours. 2e passage : places restantes.
  for (const pass of ["quota", "rest"] as const) {
    for (const role of ROLE_ORDER) {
      const list = byRole.get(role)!;
      const slice = pass === "quota" ? list.slice(0, QUOTAS[role]) : list.slice(QUOTAS[role]);
      for (const candidate of slice) {
        if (selected.length >= budget) return selected;
        selected.push(candidate);
      }
    }
  }
  return selected;
}
