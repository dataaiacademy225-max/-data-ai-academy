import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crawlSite, type CrawlProgress } from "@/server/crawler/crawl-site";
import { startTestSite, type TestSite } from "../../helpers/test-site";

let site: TestSite;
beforeAll(async () => {
  site = await startTestSite();
});
afterAll(async () => {
  await site.close();
});

const crawl = (host: string, opts: Parameters<typeof crawlSite>[1] = {}) =>
  crawlSite(site.url(host, "/"), { policy: site.policy, delayMs: 0, ...opts });

describe("crawlSite", () => {
  it("explore l'accueil, le plan du site et les pages clés", async () => {
    const progress: CrawlProgress[] = [];
    const result = await crawl("multi-site.com", { onProgress: (p) => void progress.push(p) });
    const byRole = (role: string) => result.pages.filter((p) => p.role === role).map((p) => new URL(p.url).pathname);

    expect(result.pages[0]).toMatchObject({ role: "home", ok: true });
    expect(byRole("contact")).toEqual(["/contact"]);
    expect(byRole("about")).toEqual(["/a-propos"]);
    expect(byRole("offer")).toEqual(["/offres/conseil", "/offres/formation", "/offres/audit"]); // la 3e vient du sitemap
    expect(byRole("case_study")).toEqual(["/etudes-de-cas"]);
    expect(byRole("faq")).toEqual(["/faq"]); // uniquement dans le sitemap
    expect(byRole("blog")).toEqual(["/blog/article-1"]);

    const paths = result.pages.map((p) => new URL(p.url).pathname);
    expect(paths).not.toContain("/brochure.pdf");
    expect(paths).not.toContain("/mentions-legales");
    expect(paths).not.toContain("/connexion");
    expect(result.pages.some((p) => p.url.includes("ailleurs.com"))).toBe(false);

    expect(result.sitemap).toMatchObject({ found: true, validXml: true, urlCount: 4 });
    expect(result.sitemap!.sources).toHaveLength(2); // index + fichier de pages

    expect(progress[0]).toEqual({ phase: "home", pagesDone: 0, pagesTotal: 1 });
    expect(progress.at(-1)).toMatchObject({ phase: "done", pagesDone: result.pages.length });
  });

  it("respecte robots.txt pour chaque page", async () => {
    const result = await crawl("multi-site.com");
    const privatePage = result.pages.find((p) => p.url.includes("/prive/"));
    expect(privatePage).toMatchObject({ ok: false, error: { code: "ROBOTS_DISALLOWED" } });
  });

  it("relève les liens cassés réellement constatés depuis l'accueil", async () => {
    const result = await crawl("multi-site.com");
    expect(result.brokenLinks?.broken).toEqual([site.url("multi-site.com", "/page-cassee")]);
    expect(result.brokenLinks?.checked).toBeGreaterThan(5);
  });

  it("respecte le nombre maximal de pages", async () => {
    const result = await crawl("multi-site.com", { maxPages: 4 });
    expect(result.pages).toHaveLength(4);
    expect(result.pages.map((p) => p.role)).toEqual(["home", "contact", "about", "offer"]);
  });

  it("s'arrête quand le budget de temps est épuisé et liste les pages non analysées", async () => {
    const result = await crawl("multi-site.com", { budgetMs: 0 });
    expect(result.pages).toHaveLength(1);
    expect(result.skipped.length).toBeGreaterThan(5);
  });

  it("sans sitemap déclaré : essaie /sitemap.xml et constate l'absence (404)", async () => {
    const result = await crawl("sans-sitemap.com");
    expect(result.sitemap).toEqual({ found: false, validXml: false, urlCount: 0, urls: [], sources: [] });
  });

  it("accueil inaccessible : une seule page en échec, rien d'autre n'est tenté", async () => {
    const result = await crawlSite(site.url("site-test.com", "/erreur"), { policy: site.policy, delayMs: 0 });
    expect(result).toMatchObject({ pages: [{ role: "home", ok: false, error: { code: "HTTP_ERROR" } }], sitemap: null, brokenLinks: null });
  });
});
