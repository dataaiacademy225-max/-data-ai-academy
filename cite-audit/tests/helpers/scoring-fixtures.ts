import { readFileSync } from "node:fs";
import path from "node:path";
import { extractPageFacts } from "@/server/crawler/extract";
import type { CrawlError, UrlAnalysis } from "@/server/crawler/types";
import type { PageRole, ScoringContext, ScoringInput, SiteSignals } from "@/server/scoring/types";

export const SITE_URL = "https://www.cabinet-clair.com/";

export const CONTEXT: ScoringContext = {
  companyName: "Cabinet Clair",
  sector: "Conseil data",
  primaryTarget: "Dirigeants de PME",
  city: "Abidjan",
  country: "CI",
  geoQueries: [],
};

export function fixture(name: string): string {
  return readFileSync(path.resolve(import.meta.dirname, `../fixtures/sites/${name}.html`), "utf8");
}

/** Construit une analyse comme le ferait le crawler, à partir d'un HTML de test (sans réseau). */
export function analysisFromHtml(html: string, url = SITE_URL, overrides: Partial<UrlAnalysis> = {}): UrlAnalysis {
  return {
    requestedUrl: url,
    finalUrl: url,
    httpStatus: 200,
    redirectChain: [],
    contentType: "text/html; charset=utf-8",
    bytes: html.length,
    fetchMs: 120,
    xRobotsTag: null,
    robotsTxt: "ALLOWED",
    facts: extractPageFacts(html, url),
    ...overrides,
  };
}

export function siteInput(
  html: string,
  options: { context?: Partial<ScoringContext>; site?: SiteSignals; extraPages?: { role: PageRole; url: string; html: string }[]; home?: Partial<UrlAnalysis> } = {},
): ScoringInput {
  return {
    context: { ...CONTEXT, ...options.context },
    site: options.site ?? {},
    pages: [
      { role: "home", url: SITE_URL, ok: true, analysis: analysisFromHtml(html, SITE_URL, options.home) },
      ...(options.extraPages ?? []).map((p) => ({ role: p.role, url: p.url, ok: true as const, analysis: analysisFromHtml(p.html, p.url) })),
    ],
  };
}

export function failedInput(error: CrawlError): ScoringInput {
  return { context: CONTEXT, site: {}, pages: [{ role: "home", url: SITE_URL, ok: false, error }] };
}
