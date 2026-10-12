import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "@/lib/csp";

describe("Content-Security-Policy", () => {
  it("en production : scripts limités au nonce, aucun eval, aucune intégration dans un cadre", () => {
    const csp = buildCsp("abc123", { dev: false, https: true });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("en local HTTP : pas de passage forcé en HTTPS ; eval seulement en développement", () => {
    expect(buildCsp("n", { dev: false, https: false })).not.toContain("upgrade-insecure-requests");
    expect(buildCsp("n", { dev: true, https: false })).toContain("'unsafe-eval'");
  });

  it("génère un nonce différent à chaque appel", () => {
    const a = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
    expect(createNonce()).not.toBe(a);
  });
});
