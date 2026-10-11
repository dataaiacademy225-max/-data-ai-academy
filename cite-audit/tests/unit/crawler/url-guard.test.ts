import { describe, expect, it } from "vitest";
import { isPublicAddress } from "@/server/crawler/ip-policy";
import type { NetworkPolicy } from "@/server/crawler/types";
import { checkUrl, redactUrl, resolveAllowed } from "@/server/crawler/url-guard";

const policy: NetworkPolicy = {
  resolve: async (host) => {
    const table: Record<string, string[]> = {
      "public.com": ["93.184.216.34"],
      "piege.com": ["10.0.0.1"],
      "mixte.com": ["93.184.216.34", "127.0.0.1"],
      "vide.com": [],
    };
    const list = table[host];
    if (!list) throw new Error("ENOTFOUND");
    return list.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }) as const);
  },
  isAllowedAddress: isPublicAddress,
  allowedPorts: [80, 443],
};

const code = (raw: string) => {
  const r = checkUrl(raw, policy);
  return r.ok ? "OK" : r.error.code;
};

describe("checkUrl — URL invalide", () => {
  it.each(["", "   ", "pas une url", "ftp://site.com/fichier", "javascript:alert(1)", "file:///etc/passwd", "data:text/html,x", `https://a.com/${"x".repeat(2100)}`])(
    "refuse %j",
    (raw) => expect(code(raw)).toBe("INVALID_URL"),
  );
});

describe("checkUrl — adresses locales, privées et internes bloquées", () => {
  it.each([
    "http://localhost/",
    "http://LOCALHOST./admin",
    "http://app.localhost/",
    "http://127.0.0.1/",
    "http://2130706433/", // 127.0.0.1 en décimal
    "http://0x7f.0.0.1/", // 127.0.0.1 en hexadécimal
    "http://0177.0.0.1/", // 127.0.0.1 en octal
    "http://10.0.0.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://intranet/",
    "http://serveur.local/",
    "http://api.internal/",
    "http://nas.lan/",
    "https://site.com:8443/",
    "http://site.com:22/",
    "https://user:motdepasse@site.com/",
  ])("bloque %s", (raw) => expect(code(raw)).toBe("BLOCKED_PRIVATE"));

  it.each(["https://site.com", "http://site.com:80/page", "https://www.site.co.uk/fr?x=1", "http://93.184.216.34/"])(
    "accepte %s",
    (raw) => expect(code(raw)).toBe("OK"),
  );
});

describe("resolveAllowed", () => {
  it("accepte un domaine qui ne pointe que vers des IP publiques", async () => {
    expect((await resolveAllowed("public.com", policy)).ok).toBe(true);
  });

  it.each([
    ["piege.com", "BLOCKED_PRIVATE"],
    ["mixte.com", "BLOCKED_PRIVATE"],
    ["inconnu.com", "DNS_ERROR"],
    ["vide.com", "DNS_ERROR"],
  ])("%s → %s", async (host, expected) => {
    const r = await resolveAllowed(host, policy);
    expect(r.ok ? "OK" : r.error.code).toBe(expected);
  });
});

describe("redactUrl", () => {
  it("retire identifiants, paramètres et ancre", () => {
    expect(redactUrl("https://u:p@site.com/page?token=secret#x")).toBe("https://site.com/page");
  });
});
