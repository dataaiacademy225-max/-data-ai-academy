import { describe, expect, it } from "vitest";
import { logger, sanitize, sanitizeText, setLogSink } from "@/lib/logger";

describe("sanitizeText", () => {
  it("masque e-mails, jetons et paramètres d'URL", () => {
    const out = sanitizeText(
      "Échec pour awa@exemple.com via https://u:p@site.com/page?token=abc#x avec Bearer eyJhbGciOi.secret et sk-live_1234567890abcdef",
    );
    expect(out).toContain("[email]");
    expect(out).toContain("https://site.com/page");
    expect(out).not.toMatch(/awa@|token=abc|u:p@|eyJhbGciOi|sk-live/);
  });
});

describe("sanitize", () => {
  it("masque les clés sensibles quelle que soit leur valeur", () => {
    expect(sanitize({ password: "x", apiKey: "y", cookie: "z", url: "https://a.com/?q=1", nested: { secretToken: "t" } })).toEqual({
      password: "[masqué]",
      apiKey: "[masqué]",
      cookie: "[masqué]",
      url: "https://a.com/",
      nested: { secretToken: "[masqué]" },
    });
  });

  it("réduit une erreur à son nom et son code (pas de message ni de pile)", () => {
    const err = Object.assign(new Error("échec avec clé sk-test_abcdefghijklmnop"), { code: "ECONNRESET" });
    expect(sanitize(err)).toEqual({ name: "Error", code: "ECONNRESET" });
  });
});

describe("logger", () => {
  it("écrit une ligne JSON masquée", () => {
    const lines: string[] = [];
    const restore = setLogSink((_, line) => lines.push(line));
    logger.warn("test.event", { url: "https://site.com/x?session=abc", authorization: "Bearer zzz" });
    restore();
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({ level: "warn", event: "test.event", url: "https://site.com/x", authorization: "[masqué]" });
  });
});
