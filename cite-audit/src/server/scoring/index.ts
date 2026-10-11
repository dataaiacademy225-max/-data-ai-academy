/** Point d'entrée du moteur de scoring CITE (pur : aucun réseau, aucune base de données). */
export { scoreSite, DISCLAIMER, METHOD, MIN_COVERAGE, INDICATIVE_BELOW, PRIORITY_RANK } from "@/server/scoring/engine";
export { CRITERIA, PILLARS } from "@/server/scoring/catalog";
export { findForbiddenWording } from "@/server/scoring/wording-guard";
export * from "@/server/scoring/types";
