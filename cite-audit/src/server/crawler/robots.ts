import robotsParser from "robots-parser";
import type { CrawlError, FetchedResource, Result } from "@/server/crawler/types";

/** Nom de robot à cibler dans un robots.txt (« User-agent: CITE-Audit »). */
export const ROBOTS_USER_AGENT = "CITE-Audit";

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

/** Vérificateur avec cache par origine : robots.txt n'est téléchargé qu'une fois par site. */
export function createRobotsChecker(fetchRobots: (robotsUrl: URL) => Promise<Result<FetchedResource>>) {
  const cache = new Map<string, Promise<Result<FetchedResource>>>();
  return async (pageUrl: URL): Promise<RobotsDecision> => {
    const robotsUrl = new URL("/robots.txt", pageUrl.origin);
    let pending = cache.get(pageUrl.origin);
    if (!pending) {
      pending = fetchRobots(robotsUrl);
      cache.set(pageUrl.origin, pending);
    }
    return decideFromRobotsFetch(await pending, robotsUrl.toString(), pageUrl.toString());
  };
}
