/** Point d'entrée du module crawler (côté serveur uniquement). */
export { analyzeUrl, type AnalyzeOptions } from "@/server/crawler/analyze-url";
export { DEFAULT_LIMITS, defaultNetworkPolicy } from "@/server/crawler/safe-fetch";
export type { CrawlError, CrawlErrorCode, PageFacts, UrlAnalysis } from "@/server/crawler/types";
export { crawlSite, type CrawlOptions, type CrawlProgress, type SiteCrawl } from "@/server/crawler/crawl-site";
export type { CrawledPage, PageRole, SitemapResult } from "@/server/crawler/types";
