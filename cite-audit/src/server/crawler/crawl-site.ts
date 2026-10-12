import "server-only";
import { analyzeUrl, createSiteRobotsChecker } from "@/server/crawler/analyze-url";
import { DEFAULT_MAX_PAGES, selectPages } from "@/server/crawler/discover";
import { DEFAULT_LIMITS, defaultNetworkPolicy, safeFetch } from "@/server/crawler/safe-fetch";
import { fetchSitemap } from "@/server/crawler/sitemap";
import type { CrawledPage, FetchLimits, NetworkPolicy, PageRole, SitemapResult } from "@/server/crawler/types";

export type CrawlProgress = { phase: "home" | "sitemap" | "pages" | "done"; pagesDone: number; pagesTotal: number };

export type CrawlOptions = {
  policy?: NetworkPolicy;
  limits?: Partial<FetchLimits>;
  /** Nombre total de pages analysées, accueil compris. */
  maxPages?: number;
  /** Durée maximale de l'exploration ; au-delà, les pages restantes ne sont pas analysées. */
  budgetMs?: number;
  /** Pause entre deux pages, pour ne pas surcharger le site audité. */
  delayMs?: number;
  onProgress?: (progress: CrawlProgress) => void | Promise<void>;
};

export type SiteCrawl = {
  pages: CrawledPage[];
  /** null : plan du site non vérifié. */
  sitemap: SitemapResult | null;
  /** Liens internes repérés qui répondent 404/410 (constat observé, pas une estimation). */
  brokenLinks: { checked: number; broken: string[] } | null;
  /** Pages sélectionnées mais non analysées (budget de temps épuisé). */
  skipped: { url: string; role: PageRole }[];
};

const DEFAULTS = { maxPages: DEFAULT_MAX_PAGES, budgetMs: 150_000, delayMs: 500 };
const SITEMAP_LIMITS: Partial<FetchLimits> = { timeoutMs: 8_000, maxBytes: 5 * 1024 * 1024 };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Exploration d'un site : accueil → robots.txt et plan du site → sélection des pages → analyse une à une.
 * Chaque page passe par analyzeUrl (protections réseau, robots.txt, limites). Ne note rien.
 */
export async function crawlSite(startUrl: string, options: CrawlOptions = {}): Promise<SiteCrawl> {
  const policy = options.policy ?? defaultNetworkPolicy;
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const { maxPages, budgetMs, delayMs } = { ...DEFAULTS, ...options };
  const started = Date.now();
  const robots = createSiteRobotsChecker(policy, limits.timeoutMs);
  const report = async (p: CrawlProgress) => {
    await options.onProgress?.(p);
  };

  await report({ phase: "home", pagesDone: 0, pagesTotal: 1 });
  const home = await analyzeUrl(startUrl, { policy, limits, robots });
  if (!home.ok) {
    await report({ phase: "done", pagesDone: 1, pagesTotal: 1 });
    return { pages: [{ role: "home", url: startUrl, ok: false, error: home.error }], sitemap: null, brokenLinks: null, skipped: [] };
  }

  const pages: CrawledPage[] = [{ role: "home", url: startUrl, ok: true, analysis: home.value }];
  const homeUrl = new URL(home.value.finalUrl);

  await report({ phase: "sitemap", pagesDone: 1, pagesTotal: 1 });
  const sitemapLimits = { ...SITEMAP_LIMITS, timeoutMs: Math.min(SITEMAP_LIMITS.timeoutMs!, limits.timeoutMs) };
  const sitemap = await fetchSitemap(homeUrl, await robots.sitemaps(homeUrl.origin), (url) =>
    safeFetch(url, { policy, limits: sitemapLimits, accept: "application/xml,text/xml;q=0.9,*/*;q=0.1" }),
  );

  const selected = selectPages(home.value.finalUrl, home.value.facts.internalLinks, sitemap?.urls ?? [], maxPages);
  const total = selected.length + 1;
  const skipped: SiteCrawl["skipped"] = [];

  for (const [index, candidate] of selected.entries()) {
    if (Date.now() - started > budgetMs) {
      skipped.push(...selected.slice(index).map((c) => ({ url: c.url, role: c.role })));
      break;
    }
    await report({ phase: "pages", pagesDone: pages.length, pagesTotal: total });
    if (delayMs > 0) await sleep(delayMs);
    const result = await analyzeUrl(candidate.url, { policy, limits, robots });
    pages.push(
      result.ok
        ? { role: candidate.role, url: candidate.url, ok: true, analysis: result.value }
        : { role: candidate.role, url: candidate.url, ok: false, error: result.error },
    );
  }

  // Liens cassés : uniquement les pages liées depuis l'accueil réellement testées et en 404/410.
  const linkedFromHome = new Set(selected.filter((c) => c.source === "home").map((c) => c.url));
  const tested = pages.filter((p) => linkedFromHome.has(p.url));
  const broken = tested
    .filter((p) => !p.ok && p.error.code === "HTTP_ERROR" && (p.error.httpStatus === 404 || p.error.httpStatus === 410))
    .map((p) => p.url);

  await report({ phase: "done", pagesDone: pages.length, pagesTotal: total });
  return {
    pages,
    sitemap,
    brokenLinks: tested.length > 0 ? { checked: tested.length, broken } : null,
    skipped,
  };
}
