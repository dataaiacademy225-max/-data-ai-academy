/** Point d'entrée du module crawler (côté serveur uniquement). */
export { analyzeUrl, type AnalyzeOptions } from "@/server/crawler/analyze-url";
export { DEFAULT_LIMITS, defaultNetworkPolicy } from "@/server/crawler/safe-fetch";
export type { CrawlError, CrawlErrorCode, PageFacts, UrlAnalysis } from "@/server/crawler/types";
