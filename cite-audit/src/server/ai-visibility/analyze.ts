import type { AiSource } from "@/server/ai-visibility/types";

/**
 * Lecture d'une réponse d'IA. Fonction pure : la réponse n'est jamais modifiée.
 *
 * Trois niveaux distincts, jamais confondus :
 * - MENTION : le nom (ou un alias, ou le domaine) apparaît dans le texte ;
 * - CITATION : une source renvoyée par l'IA pointe vers le site de la marque ;
 * - RECOMMANDATION : la marque est mentionnée ET une formulation explicite de recommandation figure
 *   dans la même phrase ou le même point de liste. Une simple mention n'est jamais une recommandation.
 */

export type EntityRef = { name: string; aliases?: string[]; url?: string | null };

export type EntityVisibility = {
  name: string;
  mentioned: boolean;
  /** Terme effectivement trouvé (nom, alias ou domaine). */
  detectedAs: string | null;
  cited: boolean;
  recommended: boolean;
  /** Rang approximatif : n° du point de liste (ou de la phrase) où apparaît la 1re mention. */
  approxPosition: number | null;
  /** Position du 1er caractère de la mention / longueur de la réponse (0 = début). */
  positionRatio: number | null;
  /** Extrait où la marque apparaît (pour vérification humaine). */
  excerpt: string | null;
};

export type ResponseAnalysis = {
  brand: EntityVisibility;
  competitors: EntityVisibility[];
  /** Sources : celles de l'API + adresses écrites dans le texte (origine précisée). */
  sources: AiSource[];
  /** Fiabilité de la lecture automatique (0 à 1). */
  confidence: number;
};

const RECOMMEND = new RegExp(
  [
    "je (?:vous )?(?:recommande|conseille|suggere)",
    "nous (?:vous )?(?:recommandons|conseillons)",
    "recommande(?:e|s|es)?\\b",
    "a recommander",
    "(?:le |la |les )?meilleure?s? (?:choix|option|solution|cabinet|agence|prestataire)",
    "premier choix",
    "incontournable",
    "a privilegier",
    "privilegiez",
    "optez pour",
    "je choisirais",
    "ideal(?:e)? pour",
    "excellent(?:e)? choix",
    "vous pouvez (?:faire appel a|vous tourner vers|contacter)",
    "\\bi (?:would )?recommend",
    "\\brecommended\\b",
    "best (?:choice|option|pick)",
    "top pick",
  ].join("|"),
);

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ");
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Découpe en unités : points de liste si la réponse en contient, sinon phrases. */
export function splitUnits(text: string): { text: string; start: number }[] {
  const lines = text.split("\n");
  const isListLine = (l: string) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(l);
  const hasList = lines.filter(isListLine).length >= 2;
  const units: { text: string; start: number }[] = [];
  let offset = 0;
  if (hasList) {
    let current: { text: string; start: number } | null = null;
    for (const line of lines) {
      if (isListLine(line)) {
        if (current) units.push(current);
        current = { text: line, start: offset };
      } else if (current && line.trim() && /^\s{2,}/.test(line)) {
        current.text += `\n${line}`; // suite indentée du même point
      } else if (current) {
        units.push(current);
        current = null;
      }
      offset += line.length + 1;
    }
    if (current) units.push(current);
    return units;
  }
  const re = /[^.!?\n]+[.!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) if (m[0].trim()) units.push({ text: m[0], start: m.index });
  return units;
}

function analyzeEntity(entity: EntityRef, text: string, sources: AiSource[]): EntityVisibility {
  const normalized = normalizeText(text);
  const domain = domainOf(entity.url);
  const terms = [entity.name, ...(entity.aliases ?? []), ...(domain ? [domain] : [])]
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  let first: { index: number; term: string } | null = null;
  for (const term of terms) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(normalizeText(term))}(?![\\p{L}\\p{N}])`, "u");
    const m = re.exec(normalized);
    if (m && (!first || m.index < first.index)) first = { index: m.index, term };
  }

  const cited = domain !== null && sources.some((s) => {
    const d = domainOf(s.url);
    return d !== null && (d === domain || d.endsWith(`.${domain}`));
  });

  if (!first) {
    return { name: entity.name, mentioned: false, detectedAs: null, cited, recommended: false, approxPosition: null, positionRatio: null, excerpt: null };
  }

  // NFD peut allonger le texte ; la position est ramenée à l'échelle du texte original.
  const ratio = normalized.length ? first.index / normalized.length : 0;
  const units = splitUnits(text);
  const charIndex = Math.round(ratio * text.length);
  let unitIndex = units.findIndex((u, i) => charIndex >= u.start && (i === units.length - 1 || charIndex < units[i + 1].start));
  if (unitIndex < 0) unitIndex = 0;
  const unit = units[unitIndex]?.text ?? "";
  const recommended = units.some((u) => {
    const n = normalizeText(u.text);
    return terms.some((t) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(normalizeText(t))}(?![\\p{L}\\p{N}])`, "u").test(n)) && RECOMMEND.test(n);
  });

  return {
    name: entity.name,
    mentioned: true,
    detectedAs: first.term,
    cited,
    recommended,
    approxPosition: units.length ? unitIndex + 1 : null,
    positionRatio: Math.round(ratio * 100) / 100,
    excerpt: unit.trim().slice(0, 300) || null,
  };
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"')\]]+/g;

export function analyzeResponse(text: string, apiSources: AiSource[], brand: EntityRef, competitors: EntityRef[]): ResponseAnalysis {
  const sources = [...apiSources];
  const known = new Set(sources.map((s) => s.url));
  for (const match of text.match(URL_IN_TEXT) ?? []) {
    const url = match.replace(/[.,;:!?]+$/, "");
    if (!known.has(url)) {
      known.add(url);
      sources.push({ url, origin: "TEXT" });
    }
  }

  const brandResult = analyzeEntity(brand, text, sources);
  // Un nom court ou très courant (« Clair », « Atlas ») peut apparaître par hasard : fiabilité réduite.
  const shortName = brand.name.trim().split(/\s+/).length === 1 && brand.name.trim().length <= 6;
  const confidence = brandResult.mentioned && brandResult.detectedAs === brand.name && shortName ? 0.6 : text.length < 40 ? 0.5 : 0.9;

  return {
    brand: brandResult,
    competitors: competitors.map((c) => analyzeEntity(c, text, sources)),
    sources,
    confidence,
  };
}
