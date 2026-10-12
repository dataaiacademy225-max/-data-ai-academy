/** Outils de comparaison de texte, insensibles à la casse et aux accents. */

const STOPWORDS = new Set(
  (
    "les des une pour par sur dans avec aux est sont vos nos votre notre leur leurs qui que quoi dont ces cet cette " +
    "plus moins tout tous toute toutes mais ont fait faire elle ils elles nous vous son sans entre chez comme " +
    "aussi bien tres the and for with your our you are from that this into about all can will how what"
  ).split(" "),
);

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%+]+/g, " ")
    .trim();
}

/** Mots significatifs (≥ 3 lettres, hors mots vides). */
export function terms(text: string): string[] {
  return [...new Set(normalize(text).split(" ").filter((w) => w.length >= 3 && !STOPWORDS.has(w)))];
}

/** Un mot correspond s'il est égal ou partage un radical de 5 lettres (« formation » ≈ « formations »). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5);
}

/** Termes de `needles` retrouvés dans `haystack`. */
export function matchedTerms(needles: string[], haystack: string): string[] {
  const words = normalize(haystack).split(" ");
  return needles.filter((n) => words.some((w) => sameWord(n, w)));
}

export function containsPhrase(haystack: string, phrase: string): boolean {
  const p = normalize(phrase);
  return p.length > 0 && ` ${normalize(haystack)} `.includes(` ${p} `);
}

export function truncate(text: string, max = 160): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
