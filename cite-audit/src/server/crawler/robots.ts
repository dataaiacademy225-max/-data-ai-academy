import robotsParser from "robots-parser";
import type { CrawlError, FetchedResource, Result } from "@/server/crawler/types";

/** Nom de robot à cibler dans un robots.txt (« User-agent: GriotCite »). */
export const ROBOTS_USER_AGENT = "GriotCite";

export type RobotsDecision =
  | { allowed: true; status: "ALLOWED" | "NO_ROBOTS_TXT" }
  | { allowed: false; status: "DISALLOWED" }
  /** robots.txt non lu : `cause` donne la raison (adresse bloquée, domaine introuvable, erreur serveur…). */
  | { allowed: false; status: "UNREACHABLE"; cause: CrawlError };

/** Règle pure : la page est-elle autorisée par ce robots.txt ? */
export function isAllowedByRobots(robotsTxt: string, robotsUrl: string, pageUrl: string): boolean {
  return robotsParser(robotsUrl, robotsTxt).isAllowed(pageUrl, ROBOTS_USER_AGENT) !== false;
}

/**
 * Interprétation du téléchargement de robots.txt (RFC 9309) :
 * - 2xx : on applique les règles ;
 * - 4xx : pas de robots.txt, tout est autorisé ;
 * - 5xx, délai dépassé ou réseau : on s'abstient par prudence.
 */
export function decideFromRobotsFetch(fetched: Result<FetchedResource>, robotsUrl: string, pageUrl: string): RobotsDecision {
  if (fetched.ok) {
    return isAllowedByRobots(fetched.value.body, robotsUrl, pageUrl)
      ? { allowed: true, status: "ALLOWED" }
      : { allowed: false, status: "DISALLOWED" };
  }
  const status = fetched.error.httpStatus;
  if (fetched.error.code === "HTTP_ERROR" && status !== undefined && status >= 400 && status < 500) {
    return { allowed: true, status: "NO_ROBOTS_TXT" };
  }
  return { allowed: false, status: "UNREACHABLE", cause: fetched.error };
}

export type RobotsChecker = ((pageUrl: URL) => Promise<RobotsDecision>) & {
  /** Adresses des plans de site déclarées par les lignes « Sitemap: » du robots.txt de cette origine. */
  sitemaps: (origin: string) => Promise<string[]>;
};

/** Vérificateur avec cache par origine : robots.txt n'est téléchargé qu'une fois par site. */
export function createRobotsChecker(fetchRobots: (robotsUrl: URL) => Promise<Result<FetchedResource>>): RobotsChecker {
  const cache = new Map<string, Promise<Result<FetchedResource>>>();
  const load = (origin: string) => {
    let pending = cache.get(origin);
    if (!pending) {
      pending = fetchRobots(new URL("/robots.txt", origin));
      cache.set(origin, pending);
    }
    return pending;
  };
  const check = async (pageUrl: URL): Promise<RobotsDecision> => {
    const robotsUrl = new URL("/robots.txt", pageUrl.origin);
    return decideFromRobotsFetch(await load(pageUrl.origin), robotsUrl.toString(), pageUrl.toString());
  };
  const sitemaps = async (origin: string): Promise<string[]> => {
    const fetched = await load(origin);
    if (!fetched.ok) return [];
    return robotsParser(new URL("/robots.txt", origin).toString(), fetched.value.body).getSitemaps();
  };
  return Object.assign(check, { sitemaps });
}
