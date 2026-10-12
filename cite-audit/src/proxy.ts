import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { buildCsp, createNonce } from "@/lib/csp";

const PROTECTED_PREFIXES = ["/dashboard", "/projects", "/settings"];

const isProtected = (pathname: string) =>
  PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/**
 * 1. Redirection rapide vers /login quand aucun cookie de session n'est présent sur une page protégée.
 *    Ce n'est PAS le contrôle d'accès : chaque page et action revérifie la session côté serveur.
 * 2. En-tête Content-Security-Policy avec un nonce unique par requête.
 */
export function proxy(request: NextRequest) {
  if (isProtected(request.nextUrl.pathname) && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const csp = buildCsp(createNonce(), {
    dev: process.env.NODE_ENV === "development",
    https: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
  });
  // Next.js lit la CSP de la requête pour poser le nonce sur ses propres scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Toutes les pages, sauf l'API d'authentification et les fichiers statiques.
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
