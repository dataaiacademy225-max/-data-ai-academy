import "server-only";

/**
 * Adresse IP du visiteur, pour les limites anti-abus uniquement (jamais le contrôle d'accès, jamais stockée en clair).
 *
 * Les proxys (Render, Caddy, Nginx…) AJOUTENT l'adresse qu'ils voient à droite de X-Forwarded-For ;
 * tout ce qui est à gauche peut avoir été écrit par le visiteur lui-même. On lit donc l'entrée posée
 * par le proxy de confiance le plus éloigné : la N-ième en partant de la droite, N = TRUSTED_PROXY_COUNT
 * (1 par défaut : un seul proxy devant l'application, cas de Render et de docker-compose.prod.yml).
 */
export function clientIp(headers: Headers, trustedProxyCount = readTrustedProxyCount()): string {
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (trustedProxyCount > 0 && chain.length >= trustedProxyCount) return chain[chain.length - trustedProxyCount];
  // Sans proxy déclaré (développement local) : aucune adresse fiable.
  return "inconnue";
}

function readTrustedProxyCount(): number {
  const n = Number(process.env.TRUSTED_PROXY_COUNT ?? "1");
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 1;
}
