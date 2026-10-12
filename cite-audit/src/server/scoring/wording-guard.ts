/**
 * Formulations interdites (promesses de résultat). Utilisé par les tests sur tous les textes
 * du catalogue et sur les rapports générés.
 */
export const FORBIDDEN_WORDING: RegExp[] = [
  /vous serez (recommand|cit|class|premier|num[ée]ro)/i,
  /num[ée]ro\s*(1|un)\s*(dans|sur|des)\s*(les\s*)?(ia|moteurs|google|chatgpt)/i,
  /garanti(t|e|r|ssons)?\s+(une|la|votre|vos|des)\s+(citation|recommandation|position|premi[eè]re place|classement|visibilit[ée])/i,
  /(premi[eè]re place|top\s*\d+)\s+garanti/i,
  /(chatgpt|perplexity|gemini|google|l'ia)\s+(vous\s+)?(recommandera|citera|classera)/i,
  /score officiel/i,
];

export function findForbiddenWording(text: string): string[] {
  return FORBIDDEN_WORDING.filter((re) => re.test(text)).map((re) => re.source);
}
