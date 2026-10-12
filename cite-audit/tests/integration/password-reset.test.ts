import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { testOutbox } from "@/server/email/send";

const PASSWORD = "ancien-mot-de-passe";

beforeEach(() => {
  vi.stubEnv("EMAIL_TRANSPORT", "memory");
  testOutbox.length = 0;
});
afterEach(() => vi.unstubAllEnvs());

async function signUp(email: string) {
  await getAuth().api.signUpEmail({ body: { name: "Awa", email, password: PASSWORD } });
}

const tokenFrom = (text: string) => decodeURIComponent(/reset-password\?token=([^\s]+)/.exec(text)?.[1] ?? "");

describe("e-mails d'authentification", () => {
  it("envoie un e-mail de confirmation d'adresse à l'inscription", async () => {
    await signUp("awa@exemple-test.com");
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0]).toMatchObject({ to: "awa@exemple-test.com", subject: "Confirmez votre adresse e-mail" });
    expect(testOutbox[0].text).toMatch(/\/api\/auth\/verify-email\?token=/);
  });

  it("change le mot de passe avec le lien reçu, ferme les sessions, et le lien ne sert qu'une fois", async () => {
    await signUp("awa@exemple-test.com");
    expect(await prisma.session.count()).toBe(1);
    testOutbox.length = 0;

    await getAuth().api.requestPasswordReset({ body: { email: "awa@exemple-test.com" } });
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0].subject).toBe("Changer votre mot de passe CITE Audit");
    const token = tokenFrom(testOutbox[0].text);
    expect(token.length).toBeGreaterThan(10);

    await getAuth().api.resetPassword({ body: { token, newPassword: "nouveau-mot-de-passe" } });
    expect(await prisma.session.count()).toBe(0);

    await expect(getAuth().api.signInEmail({ body: { email: "awa@exemple-test.com", password: PASSWORD } })).rejects.toThrow();
    await getAuth().api.signInEmail({ body: { email: "awa@exemple-test.com", password: "nouveau-mot-de-passe" } });

    await expect(getAuth().api.resetPassword({ body: { token, newPassword: "encore-un-autre-mdp" } })).rejects.toThrow();
  });

  it("ne révèle pas si un compte existe : aucune erreur, aucun e-mail pour une adresse inconnue", async () => {
    await expect(getAuth().api.requestPasswordReset({ body: { email: "inconnu@exemple-test.com" } })).resolves.toBeDefined();
    expect(testOutbox).toHaveLength(0);
  });
});
