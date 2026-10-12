import { afterEach, describe, expect, it, vi } from "vitest";
import { getEmailEnv } from "@/lib/env";
import { resetPasswordEmail, verifyEmailEmail } from "@/server/email/templates";
import { findForbiddenWording } from "@/server/scoring/wording-guard";

const url = "https://app.exemple.com/reset-password?token=abc";

describe("gabarits d'e-mails", () => {
  for (const [name, build] of [
    ["changement de mot de passe", resetPasswordEmail],
    ["confirmation d'adresse", verifyEmailEmail],
  ] as const) {
    it(`${name} : lien présent, nom échappé, aucune promesse interdite`, () => {
      const email = build({ name: `<script>alert("x")</script> & Co`, url, validity: "1 heure" });
      expect(email.text).toContain(url);
      expect(email.html).toContain("https://app.exemple.com/reset-password?token=abc");
      expect(email.html).not.toContain("<script>");
      expect(email.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Co");
      expect(email.text).toContain("1 heure");
      for (const text of [email.subject, email.text, email.html]) expect(findForbiddenWording(text)).toEqual([]);
    });
  }

  it("échappe aussi un lien contenant des guillemets", () => {
    const email = verifyEmailEmail({ name: "A", url: 'https://x.com/?a="><b>', validity: "24 heures" });
    expect(email.html).not.toContain('"><b>');
  });
});

describe("configuration e-mail", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("par défaut : mode console", () => {
    vi.stubEnv("EMAIL_TRANSPORT", "");
    vi.stubEnv("SMTP_URL", "");
    expect(getEmailEnv().EMAIL_TRANSPORT).toBe("console");
  });

  it("le mode smtp exige SMTP_URL, sans jamais afficher de valeur", () => {
    vi.stubEnv("EMAIL_TRANSPORT", "smtp");
    vi.stubEnv("SMTP_URL", "");
    expect(() => getEmailEnv()).toThrow(/SMTP_URL est requise/);
    vi.stubEnv("SMTP_URL", "https://secret-motdepasse@exemple.com");
    expect(() => getEmailEnv()).toThrow(/SMTP_URL/);
    expect(() => getEmailEnv()).not.toThrow(/secret-motdepasse/);
  });
});
