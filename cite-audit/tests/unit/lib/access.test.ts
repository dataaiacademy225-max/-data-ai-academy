import { afterEach, describe, expect, it, vi } from "vitest";
import { isOwner, isSignupAllowed } from "@/lib/access";
import { getAccessEnv } from "@/lib/env";

const env = (over: Partial<ReturnType<typeof getAccessEnv>> = {}) => ({
  SIGNUP_MODE: "invite" as const,
  SIGNUP_ALLOWED_EMAILS: ["testeur@exemple.com"],
  OWNER_EMAILS: ["admin@data-ai-academy.com"],
  ...over,
});

describe("règles d'accès", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("mode invitation : seuls les propriétaires et les adresses autorisées s'inscrivent (sans tenir compte de la casse)", () => {
    expect(isSignupAllowed("Admin@Data-AI-Academy.com ", env())).toBe(true);
    expect(isSignupAllowed("testeur@exemple.com", env())).toBe(true);
    expect(isSignupAllowed("inconnu@exemple.com", env())).toBe(false);
  });

  it("mode ouvert : tout le monde peut s'inscrire", () => {
    expect(isSignupAllowed("inconnu@exemple.com", env({ SIGNUP_MODE: "open" }))).toBe(true);
  });

  it("propriétaire seulement si l'adresse est déclarée ET confirmée", () => {
    expect(isOwner({ email: "admin@data-ai-academy.com", emailVerified: true }, env())).toBe(true);
    expect(isOwner({ email: "admin@data-ai-academy.com", emailVerified: false }, env())).toBe(false);
    expect(isOwner({ email: "testeur@exemple.com", emailVerified: true }, env())).toBe(false);
  });

  it("configuration : invitation par défaut, listes séparées par des virgules et normalisées", () => {
    vi.stubEnv("SIGNUP_MODE", "");
    vi.stubEnv("SIGNUP_ALLOWED_EMAILS", " A@x.com, b@Y.com ,,");
    vi.stubEnv("OWNER_EMAILS", "");
    expect(getAccessEnv()).toEqual({ SIGNUP_MODE: "invite", SIGNUP_ALLOWED_EMAILS: ["a@x.com", "b@y.com"], OWNER_EMAILS: [] });
    vi.stubEnv("SIGNUP_MODE", "n'importe quoi");
    expect(getAccessEnv().SIGNUP_MODE).toBe("invite");
  });
});
