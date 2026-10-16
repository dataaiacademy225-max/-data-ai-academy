import { afterEach, describe, expect, it, vi } from "vitest";
import { getEmailEnv } from "@/lib/env";
import { accessRequestEmail, auditFinishedEmail, inactivityWarningEmail, resetPasswordEmail, verifyEmailEmail } from "@/server/email/templates";
import { findForbiddenWording } from "@/server/scoring/wording-guard";

const url = "https://app.exemple.com/reset-password?token=abc";

describe("gabarits d'e-mails", () => {
  for (const [name, build] of [
    ["changement de mot de passe", resetPasswordEmail],
    ["confirmation d'adresse", verifyEmailEmail],
    ["avertissement d'inactivité", (i: { name: string; url: string; validity: string }) =>
      inactivityWarningEmail({ name: i.name, url: i.url, inactiveFor: "3 ans", deletionDate: "1 heure" })],
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

  it("fin d'audit : score présenté comme indicateur interne, données saisies échappées, aucune promesse", () => {
    const link = "https://app.exemple.com/projects/p1/audits/a1";
    const scored = auditFinishedEmail({ name: "Awa", companyName: "<b>Cabinet</b>", score: 89, url: link });
    expect(scored.text).toContain("89 / 100");
    expect(scored.text).toContain("indicateur interne");
    expect(scored.text).toContain("Résultat non garanti");
    expect(scored.html).toContain(link);
    expect(scored.html).not.toContain("<b>Cabinet</b>");
    const unscored = auditFinishedEmail({ name: "Awa", companyName: "Cabinet", score: null, url: link });
    expect(unscored.text).toContain("n'a pas pu être calculé");
    expect(unscored.text).not.toMatch(/\/ 100/);
    for (const email of [scored, unscored]) {
      for (const text of [email.subject, email.text, email.html]) expect(findForbiddenWording(text)).toEqual([]);
    }
  });

  it("demande d'accès : valeurs saisies échappées, jamais dans l'objet", () => {
    const email = accessRequestEmail({
      name: '<img src=x onerror="alert(1)">',
      email: "a@b.co",
      company: null,
      siteUrl: "https://exemple.com/",
      message: "Bonjour\nSubject: piège",
      interest: null,
      source: "<b>x</b>",
      campaign: null,
      url: "https://app.exemple.com/settings/demandes-acces",
    });
    expect(email.subject).toBe("Nouvelle demande d'accès à GriotCite");
    expect(email.html).not.toContain("<img");
    expect(email.text).toContain("Entreprise : non renseignée");
    expect(email.text).toContain("Intérêt principal : Non précisé");
    expect(email.html).not.toContain("<b>");
    for (const text of [email.subject, email.text, email.html]) expect(findForbiddenWording(text)).toEqual([]);
  });

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
