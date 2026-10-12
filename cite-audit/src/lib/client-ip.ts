import "server-only";

/**
 * Adresse IP du visiteur, lue dans les en-têtes posés par le proxy inverse (Nginx, Caddy, hébergeur).
 * En production, le proxy DOIT remplacer ces en-têtes : sinon un client peut les falsifier.
 * Sert uniquement aux limites anti-abus, jamais au contrôle d'accès ; jamais stockée en clair.
 */
export function clientIp(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "inconnue";
}
