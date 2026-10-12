/**
 * Politique de sécurité du contenu (CSP), générée à chaque requête avec un nonce unique.
 * - Scripts : uniquement ceux de l'application portant le nonce (Next.js l'ajoute automatiquement).
 *   Un script injecté dans la page (XSS) ne connaît pas le nonce et n'est pas exécuté.
 * - Styles en ligne autorisés : utilisés par les barres de progression ; ils n'exécutent pas de code.
 * - Aucune ressource externe : les polices sont servies par l'application (next/font).
 */
export function buildCsp(nonce: string, options: { dev: boolean; https: boolean }): string {
  return [
    "default-src 'self'",
    // En développement, React a besoin de eval pour ses outils de débogage ; jamais en production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${options.dev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function createNonce(): string {
  return btoa(crypto.randomUUID());
}
