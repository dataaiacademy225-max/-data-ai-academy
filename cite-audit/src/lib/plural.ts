/** Accord en nombre : en français, 0 et 1 restent au singulier (« 1 page », « 12 pages »). */
export const agree = (n: number, singular: string, pluralForm: string): string => (n >= 2 ? pluralForm : singular);

export const plural = (n: number, singular: string, pluralForm = `${singular}s`): string =>
  `${n} ${agree(n, singular, pluralForm)}`;
