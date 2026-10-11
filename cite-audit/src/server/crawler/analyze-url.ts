import "server-only";
import { logger } from "@/lib/logger";
import { extractPageFacts } from "@/server/crawler/extract";
import { createRobotsChecker, type RobotsChecker, type RobotsDecision } from "@/server/crawler/robots";
import { DEFAULT_LIMITS, defaultNetworkPolicy, safeFetch } from "@/server/crawler/safe-fetch";
import type { CrawlError, FetchLimits, NetworkPolicy, Result, UrlAnalysis } from "@/server/crawler/types";
import { checkUrl, redactUrl } from "@/server/crawler/url-guard";

const HTML_TYPES = /^(text\/html|application\/xhtml\+xml)\b/i;
/** Erreurs qui concernent le site entier : elles priment sur l'absence de robots.txt. */
const SITE_LEVEL_ERRORS = new Set<CrawlError["code"]>(["BLOCKED_PRIVATE", "DNS_ERROR", "INVALID_URL", "NETWORK_ERROR"]);
const ROBOTS_LIMITS: Partial<FetchLimits> = { timeoutMs: 5_000, maxBytes: 512 * 1024 };

export type AnalyzeOptions = {
  policy?: NetworkPolicy;
  limits?: Partial<FetchLimits>;
  /** Vérificateur robots.txt partagé entre plusieurs pages d'un même site (évite de le retélécharger). */
  robots?: RobotsChecker;
};

/** Vérificateur robots.txt utilisant les mêmes protections réseau que les pages. */
export function createSiteRobotsChecker(policy: NetworkPolicy, timeoutMs: number): RobotsChecker {
  const robotsLimits = { ...ROBOTS_LIMITS, timeoutMs: Math.min(ROBOTS_LIMITS.timeoutMs!, timeoutMs) };
  return createRobotsChecker((robotsUrl) => safeFetch(robotsUrl, { policy, limits: robotsLimits, accept: "text/plain,*/*;q=0.1" }));
}

function failure(error: CrawlError): Result<never> {
  // Les erreurs attendues (site injoignable, 404…) sont des constats d'audit, pas des pannes.
  logger.warn("crawler.analyze_failed", { code: error.code, httpStatus: error.httpStatus, url: error.url });
  return { ok: false, error };
}

/**
 * Analyse d'une URL publique : contrôle de l'adresse, robots.txt, téléchargement sécurisé, extraction.
 * Ne note rien et n'écrit rien en base : le résultat est transmis tel quel aux étapes suivantes.
 */
export async function analyzeUrl(rawUrl: string, options: AnalyzeOptions = {}): Promise<Result<UrlAnalysis>> {
  const policy = options.policy ?? defaultNetworkPolicy;
  const limits = { ...DEFAULT_LIMITS, ...options.limits };

  const checked = checkUrl(rawUrl, policy);
  if (!checked.ok) return failure(checked.error);

  const robots = options.robots ?? createSiteRobotsChecker(policy, limits.timeoutMs);
  let lastDecision: RobotsDecision | undefined;

  try {
    const fetched = await safeFetch(checked.value, {
      policy,
      limits,
      // robots.txt est vérifié pour l'URL initiale ET pour chaque destination de redirection.
      beforeRequest: async (url) => {
        lastDecision = await robots(url);
        if (lastDecision.allowed) return null;
        if (lastDecision.status === "UNREACHABLE" && SITE_LEVEL_ERRORS.has(lastDecision.cause.code)) {
          // Le site lui-même est injoignable ou interdit : c'est la vraie cause, pas robots.txt.
          return { ...lastDecision.cause, url: redactUrl(url) };
        }
        return {
          code: "ROBOTS_DISALLOWED",
          url: redactUrl(url),
          message:
            lastDecision.status === "DISALLOWED"
              ? "Le fichier robots.txt du site interdit l'analyse de cette page."
              : "Le fichier robots.txt du site est inaccessible : par prudence, la page n'est pas analysée.",
        };
      },
    });
    if (!fetched.ok) return failure(fetched.error);

    const page = fetched.value;
    if (!page.contentType || !HTML_TYPES.test(page.contentType)) {
      return failure({
        code: "NOT_HTML",
        message: "Le contenu n'est pas une page HTML.",
        url: redactUrl(page.finalUrl),
        httpStatus: page.status,
      });
    }

    return {
      ok: true,
      value: {
        requestedUrl: page.requestedUrl,
        finalUrl: page.finalUrl,
        httpStatus: page.status,
        redirectChain: page.redirectChain,
        contentType: page.contentType,
        bytes: page.bytes,
        fetchMs: page.durationMs,
        xRobotsTag: page.xRobotsTag,
        robotsTxt: lastDecision?.status === "NO_ROBOTS_TXT" ? "NO_ROBOTS_TXT" : "ALLOWED",
        facts: extractPageFacts(page.body, page.finalUrl),
      },
    };
  } catch (err) {
    // Erreur imprévue (bug, HTML pathologique) : journalisée sans contenu de page.
    logger.error("crawler.analyze_crashed", { url: redactUrl(checked.value), error: err });
    return { ok: false, error: { code: "NETWORK_ERROR", message: "Analyse impossible.", url: redactUrl(checked.value) } };
  }
}
