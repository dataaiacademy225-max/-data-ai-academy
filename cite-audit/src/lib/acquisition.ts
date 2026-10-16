/**
 * Provenance et centres d'intérêt des demandes d'accès (fonctions pures, partagées client et serveur).
 * Sert seulement à savoir quelles publications rapportent des demandes et quoi construire en premier.
 * Aucun cookie, aucun traceur : la source vient du lien cliqué (`?utm_source=linkedin&utm_campaign=post-1`).
 */

/** Ce qui intéresse le plus la personne. Les valeurs sont stockées en base (enum `AccessInterest`). */
export const ACCESS_INTEREST_VALUES = ["SITE_AUDIT", "AI_TRACKING", "SEARCH_CONSOLE", "COMPETITORS"] as const;

export type AccessInterest = (typeof ACCESS_INTEREST_VALUES)[number];

export const ACCESS_INTEREST_LABELS: Record<AccessInterest, string> = {
  SITE_AUDIT: "Audit de mon site",
  AI_TRACKING: "Suivi dans ChatGPT et Gemini",
  SEARCH_CONSOLE: "Données Google Search Console",
  COMPETITORS: "Comparaison avec les concurrents",
};

export const interestLabel = (value: string | null): string =>
  (ACCESS_INTEREST_LABELS as Record<string, string>)[value ?? ""] ?? "Non précisé";

const KNOWN_SOURCES: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
  twitter: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  email: "E-mail",
};

export const sourceLabel = (value: string | null): string =>
  value === null ? "Inconnue" : (KNOWN_SOURCES[value] ?? value);

/**
 * Paramètre de suivi nettoyé : minuscules, 40 caractères au plus, lettres, chiffres, « . », « _ » et « - ».
 * Toute autre valeur est ignorée (null) : c'est une donnée non fiable venue de l'adresse.
 */
export function normalizeTrackingParam(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{0,39}$/.test(cleaned) ? cleaned : null;
}

export type Tracking = { source: string | null; campaign: string | null };

/** Lit `utm_source` et `utm_campaign` (ou `source` / `campaign`) dans les paramètres d'une page. */
export function readTracking(params: Record<string, string | string[] | undefined>): Tracking {
  return {
    source: normalizeTrackingParam(params.utm_source ?? params.source),
    campaign: normalizeTrackingParam(params.utm_campaign ?? params.campaign),
  };
}

/** Ajoute la provenance à un lien interne, pour la conserver jusqu'au formulaire. */
export function withTracking(href: string, { source, campaign }: Tracking): string {
  const query = new URLSearchParams();
  if (source) query.set("utm_source", source);
  if (campaign) query.set("utm_campaign", campaign);
  const qs = query.toString();
  return qs ? `${href}${href.includes("?") ? "&" : "?"}${qs}` : href;
}

/** Nombre de demandes par valeur, du plus fréquent au moins fréquent. */
export function countBy<T>(items: readonly T[], key: (item: T) => string): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));
}
