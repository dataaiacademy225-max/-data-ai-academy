import { describe, expect, it } from "vitest";
import { fetchSitemap, parseSitemapXml } from "@/server/crawler/sitemap";
import type { FetchedResource, Result } from "@/server/crawler/types";

const ok = (url: string, body: string): Result<FetchedResource> => ({
  ok: true,
  value: { requestedUrl: url, finalUrl: url, status: 200, contentType: "application/xml", xRobotsTag: null, body, bytes: body.length, redirectChain: [], durationMs: 1 },
});
const notFound: Result<FetchedResource> = { ok: false, error: { code: "HTTP_ERROR", message: "", httpStatus: 404 } };
const timeout: Result<FetchedResource> = { ok: false, error: { code: "TIMEOUT", message: "" } };

describe("parseSitemapXml", () => {
  it("lit une liste d'adresses", () => {
    expect(parseSitemapXml('<?xml version="1.0"?><urlset><url><loc> https://a.com/x </loc></url><url><loc>https://a.com/y</loc></url></urlset>')).toEqual({
      kind: "urlset",
      locs: ["https://a.com/x", "https://a.com/y"],
    });
  });
  it("lit un index de sitemaps", () => {
    expect(parseSitemapXml("<sitemapindex><sitemap><loc>https://a.com/s1.xml</loc></sitemap></sitemapindex>").kind).toBe("index");
  });
  it.each(["", "pas du xml", "<html><body>404</body></html>"])("signale un contenu invalide : %j", (xml) => {
    expect(parseSitemapXml(xml).kind).toBe("invalid");
  });
});

describe("fetchSitemap", () => {
  const site = new URL("https://www.a.com/");

  it("suit un index, ne garde que les adresses du site", async () => {
    const files: Record<string, Result<FetchedResource>> = {
      "https://www.a.com/index.xml": ok("https://www.a.com/index.xml", "<sitemapindex><sitemap><loc>https://www.a.com/p.xml</loc></sitemap></sitemapindex>"),
      "https://www.a.com/p.xml": ok("https://www.a.com/p.xml", "<urlset><url><loc>https://a.com/x</loc></url><url><loc>https://autre.com/y</loc></url></urlset>"),
    };
    const result = await fetchSitemap(site, ["https://www.a.com/index.xml"], async (u) => files[u.toString()] ?? notFound);
    expect(result).toEqual({ found: true, validXml: true, urlCount: 2, urls: ["https://a.com/x"], sources: Object.keys(files) });
  });

  it("essaie /sitemap.xml quand robots.txt n'en déclare pas ; 404 → absent (constat observé)", async () => {
    const asked: string[] = [];
    const result = await fetchSitemap(site, [], async (u) => {
      asked.push(u.toString());
      return notFound;
    });
    expect(asked).toEqual(["https://www.a.com/sitemap.xml"]);
    expect(result).toEqual({ found: false, validXml: false, urlCount: 0, urls: [], sources: [] });
  });

  it("erreur réseau → null (non vérifié), jamais « absent »", async () => {
    expect(await fetchSitemap(site, [], async () => timeout)).toBeNull();
  });

  it("fichier présent mais invalide", async () => {
    const result = await fetchSitemap(site, [], async (u) => ok(u.toString(), "<html>oops</html>"));
    expect(result).toMatchObject({ found: true, validXml: false });
  });

  it("format compressé non lu → null", async () => {
    expect(await fetchSitemap(site, ["https://www.a.com/sitemap.xml.gz"], async () => notFound)).toBeNull();
  });
});
