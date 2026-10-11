import { readFileSync } from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { isPublicAddress } from "@/server/crawler/ip-policy";
import type { NetworkPolicy } from "@/server/crawler/types";

/**
 * Faux site web local pour tester le crawler sans Internet.
 * Le crawler bloque normalement 127.0.0.1 : les tests utilisent une politique réseau dédiée
 * qui fait passer quelques noms de domaine fictifs pour des sites publics hébergés sur 127.0.0.1.
 */

export const VALID_HTML = readFileSync(path.resolve(import.meta.dirname, "../fixtures/pages/valid.html"), "utf8");

/** Noms fictifs → adresses. Seul 127.0.0.1 est exceptionnellement autorisé par la politique de test. */
const FAKE_DNS: Record<string, string[]> = {
  "site-test.com": ["127.0.0.1"],
  "www.site-test.com": ["127.0.0.1"],
  "autre-site.com": ["127.0.0.1"],
  "robots-ko.com": ["127.0.0.1"],
  "sans-robots.com": ["127.0.0.1"],
  "piege-interne.com": ["192.168.1.10"], // domaine public qui pointe vers le réseau interne
  "piege-mixte.com": ["93.184.216.34", "10.0.0.8"], // réponse DNS mixte
  "metadonnees-cloud.com": ["169.254.169.254"],
};

export type TestSite = { port: number; url: (host: string, path: string) => string; policy: NetworkPolicy; close: () => Promise<void> };

function handle(req: IncomingMessage, res: ServerResponse, port: number) {
  const host = (req.headers.host ?? "").split(":")[0];
  const url = new URL(req.url ?? "/", `http://${host}`);
  const html = (status: number, body: string) => {
    res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  };
  const redirect = (status: number, location: string) => {
    res.writeHead(status, { location });
    res.end();
  };

  if (url.pathname === "/robots.txt") {
    if (host === "robots-ko.com") return html(503, "indisponible");
    if (host === "sans-robots.com") return html(404, "absent");
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("User-agent: *\nDisallow: /prive\n");
  }

  const redirN = /^\/redir\/(\d+)$/.exec(url.pathname);
  if (redirN) {
    const n = Number(redirN[1]);
    return n > 0 ? redirect(302, `/redir/${n - 1}`) : html(200, VALID_HTML);
  }

  switch (url.pathname) {
    case "/":
    case "/page-valide":
    case "/prive/page":
      return html(200, VALID_HTML);
    case "/en-tete-robots":
      res.writeHead(200, { "content-type": "text/html", "x-robots-tag": "noindex" });
      return res.end(VALID_HTML);
    case "/latin1":
      res.writeHead(200, { "content-type": "text/html; charset=iso-8859-1" });
      return res.end(Buffer.from("<html><body><h1>Café crème</h1></body></html>", "latin1"));
    case "/redir-externe":
      return redirect(301, `http://autre-site.com:${port}/page-valide`);
    case "/redir-ip-privee":
      return redirect(302, `http://10.0.0.5:${port}/`);
    case "/redir-piege":
      return redirect(302, `http://piege-interne.com:${port}/`);
    case "/redir-localhost":
      return redirect(302, `http://localhost:${port}/`);
    case "/redir-vers-prive":
      return redirect(302, "/prive/page");
    case "/redir-boucle":
      return redirect(302, "/redir-boucle");
    case "/introuvable":
      return html(404, "<h1>Page introuvable</h1>");
    case "/erreur":
      return html(500, "<h1>Erreur serveur</h1>");
    case "/protege":
      return html(401, "<h1>Connexion requise</h1>");
    case "/pdf":
      res.writeHead(200, { "content-type": "application/pdf" });
      return res.end("%PDF-1.4");
    case "/gros": {
      // 3 Mo envoyés par morceaux, sans Content-Length.
      res.writeHead(200, { "content-type": "text/html" });
      const chunk = "<p>" + "x".repeat(64 * 1024) + "</p>";
      let sent = 0;
      const write = () => {
        while (sent < 3 * 1024 * 1024) {
          sent += chunk.length;
          if (!res.write(chunk)) return res.once("drain", write);
        }
        res.end();
      };
      return write();
    }
    case "/gros-annonce":
      res.writeHead(200, { "content-type": "text/html", "content-length": String(5 * 1024 * 1024) });
      return res.write("<p>début</p>"); // le crawler doit s'arrêter avant de lire le reste
    case "/lent":
      return; // ne répond jamais
    case "/lent-corps":
      res.writeHead(200, { "content-type": "text/html" });
      return res.write("<html><body>"); // le corps ne se termine jamais
    default:
      return html(404, "<h1>Page introuvable</h1>");
  }
}

export async function startTestSite(): Promise<TestSite> {
  let port = 0;
  const server = http.createServer((req, res) => handle(req, res, port));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;

  const policy: NetworkPolicy = {
    resolve: async (hostname) => {
      const addresses = FAKE_DNS[hostname];
      if (!addresses) throw Object.assign(new Error("not found"), { code: "ENOTFOUND" });
      return addresses.map((address) => ({ address, family: 4 as const }));
    },
    isAllowedAddress: (address) => address === "127.0.0.1" || isPublicAddress(address),
    allowedPorts: [80, 443, port],
  };

  return {
    port,
    policy,
    url: (host, p) => `http://${host}:${port}${p}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
