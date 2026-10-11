import { load, type CheerioAPI } from "cheerio";
import type { CtaFact, JsonLdBlock, LinkFact, PageFacts, ProofFact, RobotsMeta } from "@/server/crawler/types";

/**
 * Extraction des faits observables d'une page HTML. Fonction pure : aucun réseau, aucun score.
 * Le HTML est lu comme une donnée : aucun script n'est exécuté.
 * Les détections de CTA et de preuves sont des repérages automatiques : chaque élément
 * conserve l'extrait exact trouvé pour qu'un humain puisse le vérifier.
 */

const LIMITS = {
  text: 300, // longueur max d'un titre, d'un texte de lien…
  excerptWords: 150,
  links: 300,
  ctas: 50,
  proofs: 30,
  proofExcerpt: 200,
  jsonLdBytes: 20_000,
} as const;

const clean = (value: string | undefined | null, max: number = LIMITS.text): string =>
  (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Clé de comparaison d'hôte : « www. » ignoré. */
const hostKey = (host: string) => host.toLowerCase().replace(/^www\./, "");

function absoluteUrl(href: string | undefined, base: URL): URL | null {
  if (!href) return null;
  try {
    return new URL(href.trim(), base);
  } catch {
    return null;
  }
}

function parseRobotsMeta($: CheerioAPI): RobotsMeta {
  const raw: string[] = [];
  $('meta[name="robots" i], meta[name="googlebot" i]').each((_, el) => {
    const content = clean($(el).attr("content")).toLowerCase();
    if (content) raw.push(content);
  });
  const directives = raw.flatMap((r) => r.split(",").map((d) => d.trim()));
  return {
    raw,
    noindex: directives.includes("noindex") || directives.includes("none"),
    nofollow: directives.includes("nofollow") || directives.includes("none"),
  };
}

function collectJsonLdTypes(node: unknown, out: Set<string>, depth = 0) {
  if (depth > 6 || !node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdTypes(item, out, depth + 1);
    return;
  }
  const record = node as Record<string, unknown>;
  const type = record["@type"];
  if (typeof type === "string") out.add(type);
  if (Array.isArray(type)) type.filter((t) => typeof t === "string").forEach((t) => out.add(t));
  for (const value of Object.values(record)) collectJsonLdTypes(value, out, depth + 1);
}

function parseJsonLd($: CheerioAPI): JsonLdBlock[] {
  const blocks: JsonLdBlock[] = [];
  $('script[type="application/ld+json" i]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      const data: unknown = JSON.parse(raw);
      const types = new Set<string>();
      collectJsonLdTypes(data, types);
      blocks.push({
        valid: true,
        types: [...types],
        // Données conservées seulement si raisonnables : le type suffit au-delà.
        data: raw.length <= LIMITS.jsonLdBytes ? data : null,
      });
    } catch {
      blocks.push({ valid: false, error: "JSON invalide", excerpt: clean(raw, 120) });
    }
  });
  return blocks;
}

function parseOpenGraph($: CheerioAPI): Record<string, string> {
  const og: Record<string, string> = {};
  $('meta[property^="og:" i]').each((_, el) => {
    const property = clean($(el).attr("property")).toLowerCase();
    const content = clean($(el).attr("content"), 1000);
    if (property && content && !(property in og)) og[property] = content;
  });
  return og;
}

/**
 * Texte visible : scripts, styles et éléments masqués DANS LE HTML retirés (hidden, aria-hidden, style en ligne).
 * Limite assumée : un masquage par feuille de style (classe CSS) n'est pas détecté sans moteur de rendu.
 */
function visibleText($: CheerioAPI): string {
  const body = $("body").clone();
  body
    .find(
      'script, style, noscript, template, svg, iframe, object, head, [hidden], [aria-hidden="true"], [style*="display:none" i], [style*="display: none" i]',
    )
    .remove();
  // Espace entre blocs pour éviter de coller les mots de deux éléments voisins.
  body.find("p, div, li, h1, h2, h3, h4, h5, h6, br, td, section, article, header, footer").after(" ");
  return body.text().replace(/\s+/g, " ").trim();
}

/** Frontières de mot compatibles avec les lettres accentuées (\\b ne connaît que l'ASCII). */
const words = (body: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, "iu");

const ACTION_WORDS = words(
  "contact(?:ez|er)?|devis|rendez-vous|rdv|r[ée]serv\\p{L}*|demand\\p{L}*|essai|essayer|d[ée]mo|d[ée]marr\\p{L}*|commenc\\p{L}*|inscri\\p{L}*|t[ée]l[ée]charg\\p{L}*|appel\\p{L}*|[ée]crivez|discutons|parlons|obten\\p{L}*|recevoir|audit|diagnostic|whatsapp|book|get started|sign up|try|download|schedule|request|call",
);
const BOOKING_HREF = /calendly\.com|cal\.com|meet\.google|zcal\.co|tidycal|hubspot\.com\/meetings|wa\.me|whatsapp\.com/i;
const CTA_CLASS = /\b(btn|button|cta)\b|btn-|button-|cta-/i;

function extractCtas($: CheerioAPI, base: URL): CtaFact[] {
  const ctas: CtaFact[] = [];
  const seen = new Set<string>();
  // Ordre de chaque élément dans le document, calculé une seule fois.
  const order = new Map<unknown, number>();
  $("*").each((i, el) => {
    order.set(el, i);
  });
  const firstH2 = $("h2").get(0);
  const firstH2Index = firstH2 ? (order.get(firstH2) ?? Infinity) : Infinity;

  $('a[href], button, input[type="submit" i], input[type="button" i]').each((_, el) => {
    if (ctas.length >= LIMITS.ctas) return false;
    const node = $(el);
    const tag = el.tagName.toLowerCase();
    const text = clean(tag === "input" ? node.attr("value") : node.text() || node.attr("aria-label"), 120);
    const href = tag === "a" ? absoluteUrl(node.attr("href"), base) : null;
    const rawHref = node.attr("href") ?? "";
    if (/^javascript:/i.test(rawHref)) return;

    const isAction =
      tag !== "a" ||
      CTA_CLASS.test(node.attr("class") ?? "") ||
      node.attr("role") === "button" ||
      ACTION_WORDS.test(text) ||
      (href !== null && (BOOKING_HREF.test(href.href) || href.protocol === "tel:" || href.protocol === "mailto:"));
    if (!isAction || !text) return;
    // Un bouton sans action visible (menu, fermeture…) n'est pas un appel à l'action.
    if (tag === "button" && !ACTION_WORDS.test(text) && node.attr("type") !== "submit") return;

    const key = `${text.toLowerCase()}|${href?.href ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    ctas.push({
      text,
      href: href ? href.href : null,
      element: tag === "a" ? "link" : tag === "input" ? "input" : "button",
      position: (order.get(el) ?? Infinity) < firstH2Index ? "top" : "rest",
    });
  });
  return ctas;
}

const PROOF_TEXT_PATTERNS: { type: ProofFact["type"]; pattern: RegExp }[] = [
  {
    type: "result_figure",
    pattern:
      /[+-]?\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d+)?\s?(?:%|x(?![\p{L}])|×|k€|m€|€|fcfa|clients?|projets?|entreprises?|ans d'exp|années d'exp|leads?|rendez-vous|participants?|apprenants?)/iu,
  },
  {
    type: "certification",
    pattern: words("certifi[ée]e?s?|accr[ée]dit[ée]e?s?|agr[ée][ée]e?s?|qualiopi|iso\\s?\\d{4,5}|partenaire\\s+(?:google|microsoft|hubspot|meta|aws)"),
  },
  { type: "rating", pattern: /\d(?:[.,]\d)?\s?\/\s?5(?!\d)|★|\d(?:[.,]\d)?\s?(?:étoiles|stars)/iu },
  {
    type: "case_study",
    pattern: words("[ée]tudes? de cas|cas clients?|case stud(?:y|ies)|success stor(?:y|ies)|r[ée]alisations|t[ée]moignages? clients?"),
  },
];

const TESTIMONIAL_MARKUP = /testimonial|temoignage|témoignage|review|avis-client|customer-quote/i;
const LOGOS_MARKUP = /client|logo|partner|partenaire|trusted|references|références/i;
const LOGOS_HEADING = /ils nous font confiance|nos clients|nos r[ée]f[ée]rences|trusted by|our clients|partenaires/i;

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+|\s{2,}/).filter((s) => s.length >= 8);
}

function extractProofs($: CheerioAPI, text: string, jsonLd: JsonLdBlock[]): ProofFact[] {
  const proofs: ProofFact[] = [];
  const seen = new Set<string>();
  const add = (type: ProofFact["type"], excerpt: string, source: ProofFact["source"]) => {
    const value = clean(excerpt, LIMITS.proofExcerpt);
    const key = `${type}|${value.toLowerCase()}`;
    if (!value || seen.has(key) || proofs.length >= LIMITS.proofs) return;
    seen.add(key);
    proofs.push({ type, excerpt: value, source });
  };

  // Témoignages balisés : <blockquote> ou classe/id explicite.
  $("blockquote, [class], [id]").each((_, el) => {
    const node = $(el);
    const marker = `${node.attr("class") ?? ""} ${node.attr("id") ?? ""}`;
    if (el.tagName.toLowerCase() === "blockquote" || TESTIMONIAL_MARKUP.test(marker)) {
      const quote = clean(node.text(), LIMITS.proofExcerpt);
      if (quote.length >= 20) add("testimonial", quote, "markup");
    }
  });

  // Logos clients : bloc repéré par sa classe ou son titre, contenant au moins 2 images.
  $("section, div, ul").each((_, el) => {
    const node = $(el);
    const marker = `${node.attr("class") ?? ""} ${node.attr("id") ?? ""}`;
    const heading = clean(node.children("h2, h3, h4, p").first().text(), 120);
    const images = node.find("img").length;
    if (images >= 2 && (LOGOS_MARKUP.test(marker) || LOGOS_HEADING.test(heading))) {
      const alts = node
        .find("img")
        .map((__, img) => clean($(img).attr("alt"), 40))
        .get()
        .filter(Boolean)
        .slice(0, 6);
      add("client_logos", `${heading || "Bloc de logos"} (${images} images${alts.length ? ` : ${alts.join(", ")}` : ""})`, "markup");
    }
  });

  // Données structurées : avis et notes déclarés.
  for (const block of jsonLd) {
    if (!block.valid) continue;
    if (block.types.includes("Review")) add("testimonial", "Avis déclaré en données structurées (Review)", "json-ld");
    if (block.types.includes("AggregateRating")) add("rating", "Note moyenne déclarée en données structurées (AggregateRating)", "json-ld");
  }

  // Formulations dans le texte visible : chiffres de résultats, certifications, notes, études de cas.
  for (const sentence of sentences(text)) {
    for (const { type, pattern } of PROOF_TEXT_PATTERNS) {
      if (pattern.test(sentence)) add(type, sentence, "text");
    }
  }
  return proofs;
}

function extractLinks($: CheerioAPI, base: URL) {
  const internal: LinkFact[] = [];
  const external: LinkFact[] = [];
  const emails = new Set<string>();
  const phones = new Set<string>();
  const seen = new Set<string>();
  const siteHost = hostKey(base.hostname);

  $("a[href]").each((_, el) => {
    const node = $(el);
    const url = absoluteUrl(node.attr("href"), base);
    if (!url) return;
    if (url.protocol === "mailto:") {
      const email = decodeURIComponent(url.pathname).toLowerCase();
      if (email) emails.add(email);
      return;
    }
    if (url.protocol === "tel:") {
      const phone = decodeURIComponent(url.pathname).replace(/[^\d+]/g, "");
      if (phone) phones.add(phone);
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    url.hash = "";
    const key = url.href;
    if (seen.has(key)) return;
    seen.add(key);
    const link: LinkFact = {
      url: url.href,
      text: clean(node.text() || node.attr("aria-label") || node.find("img").attr("alt"), 120),
      nofollow: /\bnofollow\b/i.test(node.attr("rel") ?? ""),
    };
    const target = hostKey(url.hostname) === siteHost ? internal : external;
    if (target.length < LIMITS.links) target.push(link);
  });
  return { internal, external, emails: [...emails].slice(0, 20), phones: [...phones].slice(0, 20) };
}

/**
 * @param html  HTML reçu (non exécuté)
 * @param pageUrl  URL finale de la page, pour résoudre les liens relatifs
 */
export function extractPageFacts(html: string, pageUrl: string): PageFacts {
  const $ = load(html);
  const pageBase = new URL(pageUrl);
  const baseHref = absoluteUrl($("base[href]").first().attr("href"), pageBase);
  const base = baseHref && (baseHref.protocol === "http:" || baseHref.protocol === "https:") ? baseHref : pageBase;

  const text = visibleText($);
  const wordList = text ? text.split(" ") : [];
  const jsonLd = parseJsonLd($);
  const links = extractLinks($, base);

  const appRoot = $("#__next, #root, #app, [data-reactroot], [ng-app], [data-server-rendered]").length > 0;
  const scripts = $("script[src]").length;

  let missingAlt = 0;
  const images = $("img");
  images.each((_, el) => {
    if (!clean($(el).attr("alt"))) missingAlt += 1;
  });

  const canonical = $('link[rel~="canonical" i]')
    .map((_, el) => absoluteUrl($(el).attr("href"), base)?.href)
    .get()
    .filter((href): href is string => Boolean(href));

  return {
    lang: clean($("html").attr("lang"), 20) || null,
    title: clean($("title").first().text()) || null,
    metaDescription: clean($('meta[name="description" i]').first().attr("content"), 1000) || null,
    robotsMeta: parseRobotsMeta($),
    canonical: [...new Set(canonical)],
    h1: $("h1").map((_, el) => clean($(el).text())).get().filter(Boolean),
    h2: $("h2").map((_, el) => clean($(el).text())).get().filter(Boolean).slice(0, 100),
    visibleText: { wordCount: wordList.length, excerpt: wordList.slice(0, LIMITS.excerptWords).join(" ") },
    likelyClientRendered: wordList.length < 50 && (appRoot || scripts > 0),
    internalLinks: links.internal,
    externalLinks: links.external,
    contactLinks: { emails: links.emails, phones: links.phones },
    images: { total: images.length, missingAlt },
    jsonLd,
    openGraph: parseOpenGraph($),
    ctas: extractCtas($, base),
    proofs: extractProofs($, text, jsonLd),
  };
}
