import { load } from "cheerio";
import type { FetchedResource, Result, SitemapResult } from "@/server/crawler/types";

/** Plafonds : un site peut déclarer des dizaines de milliers d'adresses ; on n'en garde qu'un échantillon. */
const MAX_FILES = 4;
const MAX_URLS = 500;

export type ParsedSitemap = { kind: "urlset" | "index" | "invalid"; locs: string[] };

/** Lecture d'un fichier sitemap XML (fonction pure). Le XML n'est jamais exécuté. */
export function parseSitemapXml(xml: string): ParsedSitemap {
  const text = xml.trim();
  if (!text.startsWith("<")) return { kind: "invalid", locs: [] };
  const $ = load(text, { xml: true });
  const read = (selector: string) =>
    $(selector)
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);
  if ($("urlset").length) return { kind: "urlset", locs: read("urlset > url > loc") };
  if ($("sitemapindex").length) return { kind: "index", locs: read("sitemapindex > sitemap > loc") };
  return { kind: "invalid", locs: [] };
}

const hostKey = (host: string) => host.toLowerCase().replace(/^www\./, "");

/**
 * Récupère le plan du site : adresses déclarées dans robots.txt, sinon /sitemap.xml.
 * Les fichiers compressés (.xml.gz) sont décompressés par safeFetch, taille plafonnée.
 * Renvoie null si rien n'a pu être vérifié (réseau, fichier illisible) : jamais « absent » par défaut.
 */
export async function fetchSitemap(
  siteUrl: URL,
  declared: string[],
  fetcher: (url: URL) => Promise<Result<FetchedResource>>,
): Promise<SitemapResult | null> {
  const siteHost = hostKey(siteUrl.hostname);
  const queue: string[] = declared.length > 0 ? [...declared] : [new URL("/sitemap.xml", siteUrl.origin).toString()];
  const seen = new Set<string>();
  const sources: string[] = [];
  const urls = new Set<string>();
  let urlCount = 0;
  let found = false;
  let validXml = false;
  let notFoundOnly = true;

  while (queue.length > 0 && seen.size < MAX_FILES) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    let target: URL;
    try {
      target = new URL(next);
    } catch {
      continue;
    }
    const fetched = await fetcher(target);
    if (!fetched.ok) {
      const status = fetched.error.httpStatus;
      if (!(fetched.error.code === "HTTP_ERROR" && (status === 404 || status === 410))) notFoundOnly = false;
      continue;
    }
    notFoundOnly = false;
    found = true;
    sources.push(fetched.value.finalUrl);
    const parsed = parseSitemapXml(fetched.value.body);
    if (parsed.kind === "invalid") continue;
    validXml = true;
    if (parsed.kind === "index") {
      queue.push(...parsed.locs);
      continue;
    }
    urlCount += parsed.locs.length;
    for (const loc of parsed.locs) {
      if (urls.size >= MAX_URLS) break;
      try {
        const u = new URL(loc);
        if ((u.protocol === "http:" || u.protocol === "https:") && hostKey(u.hostname) === siteHost) {
          u.hash = "";
          urls.add(u.toString());
        }
      } catch {
        // adresse invalide dans le sitemap : ignorée
      }
    }
  }

  if (!found) {
    // Toutes les tentatives ont répondu 404/410 : le constat « pas de sitemap » est observé.
    return notFoundOnly ? { found: false, validXml: false, urlCount: 0, urls: [], sources: [] } : null;
  }
  return { found, validXml, urlCount, urls: [...urls], sources };
}
