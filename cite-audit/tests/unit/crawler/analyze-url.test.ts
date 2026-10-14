import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setLogSink } from "@/lib/logger";
import { analyzeUrl, type AnalyzeOptions } from "@/server/crawler/analyze-url";
import { defaultNetworkPolicy, safeFetch } from "@/server/crawler/safe-fetch";
import { startTestSite, type TestSite } from "../../helpers/test-site";

/**
 * Tests de bout en bout du module d'analyse, contre un serveur HTTP local (aucun accès Internet).
 */

let site: TestSite;
let logs: string[] = [];
let restoreLogs: () => void;

beforeAll(async () => {
  site = await startTestSite();
  restoreLogs = setLogSink((_, line) => logs.push(line));
});

afterAll(async () => {
  restoreLogs();
  await site.close();
});

const analyze = (url: string, limits?: AnalyzeOptions["limits"]) =>
  analyzeUrl(url, { policy: site.policy, limits });

async function errorOf(url: string, limits?: AnalyzeOptions["limits"]) {
  const result = await analyze(url, limits);
  if (result.ok) throw new Error(`succès inattendu pour ${url}`);
  return result.error;
}

describe("URL invalide", () => {
  it.each(["", "pas une url", "ftp://site-test.com/", "javascript:alert(1)"])("%j → INVALID_URL", async (url) => {
    expect((await errorOf(url)).code).toBe("INVALID_URL");
  });

  it("nom de domaine inexistant → DNS_ERROR", async () => {
    expect((await errorOf(site.url("domaine-inconnu.com", "/"))).code).toBe("DNS_ERROR");
  });
});

describe("URL locale ou privée bloquée", () => {
  it.each([
    "http://localhost/",
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://intranet/",
    "http://serveur.local/",
  ])("%s → BLOCKED_PRIVATE (politique de production)", async (url) => {
    const result = await analyzeUrl(url, { policy: defaultNetworkPolicy });
    expect(result.ok ? "OK" : result.error.code).toBe("BLOCKED_PRIVATE");
  });

  it.each(["piege-interne.com", "piege-mixte.com", "metadonnees-cloud.com"])(
    "domaine public %s qui pointe vers une IP privée → BLOCKED_PRIVATE",
    async (host) => {
      expect((await errorOf(site.url(host, "/"))).code).toBe("BLOCKED_PRIVATE");
    },
  );

  it("port non standard refusé", async () => {
    expect((await analyzeUrl("http://site-test.com:8080/", { policy: site.policy })).ok).toBe(false);
  });
});

describe("page valide", () => {
  it("renvoie le code HTTP et les faits extraits", async () => {
    const result = await analyze(site.url("site-test.com", "/page-valide"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const a = result.value;
    expect(a.httpStatus).toBe(200);
    expect(a.redirectChain).toEqual([]);
    expect(a.contentType).toMatch(/text\/html/);
    expect(a.robotsTxt).toBe("ALLOWED");
    expect(a.bytes).toBeGreaterThan(1000);
    expect(a.facts.title).toBe("Cabinet Test — Conseil data pour PME à Abidjan");
    expect(a.facts.h1).toEqual(["Conseil data pour les PME d'Abidjan"]);
    expect(a.facts.h2).toHaveLength(4);
    expect(a.facts.canonical).toEqual([site.url("site-test.com", "/page-valide")]);
    expect(a.facts.ctas.length).toBeGreaterThan(0);
    expect(a.facts.proofs.length).toBeGreaterThan(0);
  });

  it("transmet l'en-tête X-Robots-Tag", async () => {
    const result = await analyze(site.url("site-test.com", "/en-tete-robots"));
    expect(result.ok && result.value.xRobotsTag).toBe("noindex");
  });

  it("décode un charset non UTF-8", async () => {
    const result = await analyze(site.url("site-test.com", "/latin1"));
    expect(result.ok && result.value.facts.h1).toEqual(["Café crème"]);
  });

  it("sans robots.txt (404), la page est analysée et c'est signalé", async () => {
    const result = await analyze(site.url("sans-robots.com", "/page-valide"));
    expect(result.ok && result.value.robotsTxt).toBe("NO_ROBOTS_TXT");
  });
});

describe("redirection", () => {
  it("suit jusqu'à 5 redirections et enregistre la chaîne", async () => {
    const result = await analyze(site.url("site-test.com", "/redir/5"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.redirectChain).toHaveLength(5);
    expect(result.value.redirectChain[0]).toEqual({ url: site.url("site-test.com", "/redir/5"), status: 302 });
    expect(result.value.finalUrl).toBe(site.url("site-test.com", "/redir/0"));
  });

  it("refuse au-delà de la limite", async () => {
    expect((await errorOf(site.url("site-test.com", "/redir/6"))).code).toBe("TOO_MANY_REDIRECTS");
    expect((await errorOf(site.url("site-test.com", "/redir-boucle"))).code).toBe("TOO_MANY_REDIRECTS");
  });

  it("respecte une limite personnalisée", async () => {
    expect((await errorOf(site.url("site-test.com", "/redir/2"), { maxRedirects: 1 })).code).toBe("TOO_MANY_REDIRECTS");
  });

  it("suit une redirection vers un autre domaine public", async () => {
    const result = await analyze(site.url("site-test.com", "/redir-externe"));
    expect(result.ok && result.value.finalUrl).toBe(site.url("autre-site.com", "/page-valide"));
  });

  it.each([
    ["/redir-ip-privee", "IP privée"],
    ["/redir-piege", "domaine qui pointe vers une IP privée"],
    ["/redir-localhost", "localhost"],
  ])("bloque une redirection vers %s (%s)", async (path) => {
    expect((await errorOf(site.url("site-test.com", path))).code).toBe("BLOCKED_PRIVATE");
  });

  it("revérifie robots.txt après redirection", async () => {
    expect((await errorOf(site.url("site-test.com", "/redir-vers-prive"))).code).toBe("ROBOTS_DISALLOWED");
  });
});

describe("page inaccessible", () => {
  it.each([
    ["/introuvable", 404],
    ["/erreur", 500],
    ["/protege", 401],
  ])("%s → HTTP_ERROR avec le vrai code %i", async (path, status) => {
    const error = await errorOf(site.url("site-test.com", path));
    expect(error).toMatchObject({ code: "HTTP_ERROR", httpStatus: status });
  });

  it("page interdite par robots.txt → ROBOTS_DISALLOWED, sans téléchargement", async () => {
    expect((await errorOf(site.url("site-test.com", "/prive/page"))).code).toBe("ROBOTS_DISALLOWED");
  });

  it("robots.txt en erreur 5xx → abstention", async () => {
    const error = await errorOf(site.url("robots-ko.com", "/page-valide"));
    expect(error.code).toBe("ROBOTS_DISALLOWED");
    expect(error.message).toMatch(/inaccessible/);
  });

  it("contenu non HTML → NOT_HTML", async () => {
    expect((await errorOf(site.url("site-test.com", "/pdf"))).code).toBe("NOT_HTML");
  });
});

describe("timeout", () => {
  it("serveur qui ne répond pas → TIMEOUT dans le délai", async () => {
    const started = Date.now();
    expect((await errorOf(site.url("site-test.com", "/lent"), { timeoutMs: 300 })).code).toBe("TIMEOUT");
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("corps qui ne se termine jamais → TIMEOUT", async () => {
    expect((await errorOf(site.url("site-test.com", "/lent-corps"), { timeoutMs: 300 })).code).toBe("TIMEOUT");
  });
});

describe("page trop volumineuse", () => {
  it("corps de 3 Mo sans Content-Length → TOO_LARGE", async () => {
    expect((await errorOf(site.url("site-test.com", "/gros"))).code).toBe("TOO_LARGE");
  });

  it("Content-Length annoncé trop grand → TOO_LARGE sans tout télécharger", async () => {
    expect((await errorOf(site.url("site-test.com", "/gros-annonce"))).code).toBe("TOO_LARGE");
  });

  it("limite personnalisée appliquée", async () => {
    expect((await errorOf(site.url("site-test.com", "/page-valide"), { maxBytes: 500 })).code).toBe("TOO_LARGE");
  });
});

describe("journalisation", () => {
  it("journalise l'échec sans paramètres d'URL ni identifiants", async () => {
    logs = [];
    await analyze(`http://admin:motdepasse@site-test.com:${site.port}/introuvable?token=secret123`);
    await analyze(site.url("site-test.com", "/introuvable?token=secret123&email=awa@exemple.com"));
    const all = logs.join("\n");
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(all).toContain("crawler.analyze_failed");
    expect(all).toContain("HTTP_ERROR");
    expect(all).not.toMatch(/secret123|motdepasse|admin:|awa@/);
  });
});

describe("safeFetch", () => {
  it("n'envoie ni cookie ni identifiant et s'annonce avec son User-Agent", async () => {
    const result = await safeFetch(site.url("site-test.com", "/page-valide"), { policy: site.policy });
    expect(result.ok && result.value.status).toBe(200);
  });
});

describe("pages compressées", () => {
  it.each(["/compresse-gzip", "/compresse-br"])("décompresse %s et analyse la page normalement", async (path) => {
    const fetched = await safeFetch(site.url("site-test.com", path), { policy: site.policy });
    expect(fetched.ok && fetched.value.body).toContain("<h1");
    const analyzed = await analyze(site.url("site-test.com", path));
    expect(analyzed.ok).toBe(true);
  });

  it("bombe de compression : arrêtée à la limite de taille décompressée → TOO_LARGE", async () => {
    const fetched = await safeFetch(site.url("site-test.com", "/bombe"), { policy: site.policy });
    expect(!fetched.ok && fetched.error.code).toBe("TOO_LARGE");
  });

  it("format de compression inconnu ou corrompu → NETWORK_ERROR, sans planter", async () => {
    for (const path of ["/encodage-inconnu", "/compresse-corrompu"]) {
      const fetched = await safeFetch(site.url("site-test.com", path), { policy: site.policy });
      expect(!fetched.ok && fetched.error.code, path).toBe("NETWORK_ERROR");
    }
  });

  it("fichier .xml.gz : décompressé (sitemap compressé)", async () => {
    const fetched = await safeFetch(site.url("site-test.com", "/sitemap.xml.gz"), { policy: site.policy });
    expect(fetched.ok && fetched.value.body).toContain("<urlset>");
  });
});
