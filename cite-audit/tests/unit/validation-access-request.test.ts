import { describe, expect, it } from "vitest";
import { accessRequestSchema } from "@/lib/validation/access-request";

const base = { name: "Awa Koné", email: " Awa@Exemple-Test.com ", company: "", siteUrl: "", message: "", consent: "on" };

describe("formulaire de demande d'accès", () => {
  it("normalise l'e-mail et transforme les champs facultatifs vides en null", () => {
    const parsed = accessRequestSchema.parse(base);
    expect(parsed).toMatchObject({ email: "awa@exemple-test.com", company: null, siteUrl: null, message: null });
  });

  it("complète l'adresse du site sans protocole et refuse une adresse invalide", () => {
    expect(accessRequestSchema.parse({ ...base, siteUrl: "cabinet-awa.ci" }).siteUrl).toBe("https://cabinet-awa.ci/");
    expect(accessRequestSchema.safeParse({ ...base, siteUrl: "pas une adresse" }).success).toBe(false);
  });

  it("intérêt facultatif, limité aux choix proposés", () => {
    expect(accessRequestSchema.parse(base).interest).toBeNull();
    expect(accessRequestSchema.parse({ ...base, interest: "" }).interest).toBeNull();
    expect(accessRequestSchema.parse({ ...base, interest: "SEARCH_CONSOLE" }).interest).toBe("SEARCH_CONSOLE");
    expect(accessRequestSchema.safeParse({ ...base, interest: "AUTRE" }).success).toBe(false);
  });

  it("provenance nettoyée : une valeur inattendue est ignorée sans bloquer l'envoi", () => {
    expect(accessRequestSchema.parse({ ...base, source: " LinkedIn ", campaign: "post-1" })).toMatchObject({
      source: "linkedin",
      campaign: "post-1",
    });
    const odd = accessRequestSchema.parse({ ...base, source: "<script>", campaign: "x".repeat(41) });
    expect(odd).toMatchObject({ source: null, campaign: null });
  });

  it("exige l'accord et limite la longueur du message", () => {
    expect(accessRequestSchema.safeParse({ ...base, consent: "" }).success).toBe(false);
    expect(accessRequestSchema.safeParse({ ...base, message: "x".repeat(1001) }).success).toBe(false);
  });
});
