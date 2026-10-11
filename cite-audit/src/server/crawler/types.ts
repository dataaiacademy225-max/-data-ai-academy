/**
 * Types du module d'analyse d'URL (crawler).
 * Ce module observe et extrait ; il ne note rien (scoring) et n'affiche rien (interface).
 */

export type CrawlErrorCode =
  | "INVALID_URL" // adresse mal formée ou schéma non http(s)
  | "BLOCKED_PRIVATE" // localhost, IP privée/réservée, domaine interne, port non autorisé
  | "DNS_ERROR" // nom de domaine introuvable
  | "NETWORK_ERROR" // connexion refusée, TLS invalide…
  | "TIMEOUT" // délai dépassé
  | "TOO_LARGE" // réponse au-delà de la taille maximale
  | "TOO_MANY_REDIRECTS"
  | "HTTP_ERROR" // code 4xx / 5xx : la page n'est pas accessible publiquement
  | "NOT_HTML" // contenu autre que HTML
  | "ROBOTS_DISALLOWED"; // interdit par robots.txt

export type CrawlError = {
  code: CrawlErrorCode;
  /** Message en clair, sans donnée sensible. */
  message: string;
  /** URL concernée, nettoyée (sans identifiants, paramètres ni ancre). */
  url?: string;
  httpStatus?: number;
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: CrawlError };

export type ResolvedAddress = { address: string; family: 4 | 6 };

/**
 * Règles réseau du crawler. Les valeurs par défaut (defaultNetworkPolicy) sont celles de production ;
 * les tests en injectent d'autres pour viser un serveur local sans affaiblir le code testé.
 */
export type NetworkPolicy = {
  /** Résolution DNS d'un nom d'hôte (toutes les adresses). */
  resolve: (hostname: string) => Promise<ResolvedAddress[]>;
  /** Une adresse IP résolue est-elle joignable ? */
  isAllowedAddress: (address: string) => boolean;
  /** Ports autorisés (80 et 443 en production). */
  allowedPorts: readonly number[];
};

export type RedirectHop = { url: string; status: number };

export type FetchLimits = {
  /** Délai maximal pour l'ensemble des requêtes d'une URL (redirections comprises). */
  timeoutMs: number;
  /** Taille maximale du corps de réponse, en octets. */
  maxBytes: number;
  /** Nombre maximal de redirections suivies. */
  maxRedirects: number;
};

export type FetchedResource = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType: string | null;
  xRobotsTag: string | null;
  body: string;
  bytes: number;
  redirectChain: RedirectHop[];
  durationMs: number;
};

export type LinkFact = { url: string; text: string; nofollow: boolean };

export type CtaFact = {
  text: string;
  href: string | null;
  element: "button" | "link" | "input";
  /** Approximation par l'ordre du document (avant le premier H2) : le rendu réel n'est pas calculé. */
  position: "top" | "rest";
};

export type ProofType =
  | "testimonial"
  | "client_logos"
  | "case_study"
  | "result_figure"
  | "certification"
  | "rating";

export type ProofFact = {
  type: ProofType;
  /** Extrait exact trouvé dans la page (tronqué), pour vérification humaine. */
  excerpt: string;
  source: "text" | "markup" | "json-ld";
};

export type JsonLdBlock =
  | { valid: true; types: string[]; data: unknown }
  | { valid: false; error: string; excerpt: string };

export type RobotsMeta = { raw: string[]; noindex: boolean; nofollow: boolean };

/** Faits observés sur une page. Uniquement ce qui est présent dans le HTML reçu. */
export type PageFacts = {
  lang: string | null;
  title: string | null;
  metaDescription: string | null;
  robotsMeta: RobotsMeta;
  canonical: string[];
  h1: string[];
  h2: string[];
  visibleText: { wordCount: number; excerpt: string };
  /** Peu de texte et une application JavaScript détectée : le contenu réel n'est pas visible sans exécution. */
  likelyClientRendered: boolean;
  internalLinks: LinkFact[];
  externalLinks: LinkFact[];
  contactLinks: { emails: string[]; phones: string[] };
  images: { total: number; missingAlt: number };
  jsonLd: JsonLdBlock[];
  openGraph: Record<string, string>;
  ctas: CtaFact[];
  proofs: ProofFact[];
};

export type UrlAnalysis = {
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  redirectChain: RedirectHop[];
  contentType: string | null;
  bytes: number;
  fetchMs: number;
  /** En-tête X-Robots-Tag, s'il existe (complète la balise meta robots). */
  xRobotsTag: string | null;
  robotsTxt: "ALLOWED" | "NO_ROBOTS_TXT";
  facts: PageFacts;
};
