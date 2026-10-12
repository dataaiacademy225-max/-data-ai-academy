import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

describe("signUpSchema", () => {
  const valid = { name: "Awa Koné", email: " Awa@Exemple.COM ", password: "motdepasse-solide", confirmPassword: "motdepasse-solide" };

  it("normalise l'e-mail", () => {
    expect(signUpSchema.parse(valid).email).toBe("awa@exemple.com");
  });

  it("exige 10 caractères minimum", () => {
    const r = signUpSchema.safeParse({ ...valid, password: "court", confirmPassword: "court" });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toMatch(/10 caractères/);
  });

  it("vérifie la confirmation", () => {
    const r = signUpSchema.safeParse({ ...valid, confirmPassword: "different-1234" });
    expect(r.error!.issues[0].path).toEqual(["confirmPassword"]);
  });

  it("refuse un e-mail invalide", () => {
    expect(signUpSchema.safeParse({ ...valid, email: "pas-un-email" }).success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("exige un mot de passe", () => {
    expect(signInSchema.safeParse({ email: "a@exemple.com", password: "" }).success).toBe(false);
  });
});
