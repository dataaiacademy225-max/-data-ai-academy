import { describe, expect, it } from "vitest";
import { classifyPage, pageKey, selectPages } from "@/server/crawler/discover";

const link = (url: string, text = "") => ({ url, text, nofollow: false });
const HOME = "https://www.site.com/";

describe("classifyPage", () => {
  it.each([
    ["https://site.com/contact", "", "contact"],
    ["https://site.com/x", "Demander un devis", "contact"],
    ["https://site.com/a-propos", "", "about"],
    ["https://site.com/qui-sommes-nous", "", "about"],
    ["https://site.com/nos-offres/conseil", "", "offer"],
    ["https://site.com/services", "", "offer"],
    ["https://site.com/etudes-de-cas/banque", "", "case_study"],
    ["https://site.com/references", "", "case_study"],
    ["https://site.com/faq", "", "faq"],
    ["https://site.com/blog/mon-article", "", "blog"],
    ["https://site.com/carrieres", "", "other"],
  ])("%s (%s) → %s", (url, text, role) => {
    expect(classifyPage(new URL(url), text)).toBe(role);
  });
});

describe("selectPages", () => {
  it("garde le même site, sans doublon, sans fichier, connexion ni mentions légales", () => {
    const selected = selectPages(
      HOME,
      [
        link("https://site.com/offres", "Offres"), // même site sans www
        link("https://www.site.com/offres/#tarifs", "Tarifs"), // doublon (ancre + / final)
        link("https://www.site.com/offres?utm_source=x", "Offres"), // doublon (paramètres)
        link("https://www.site.com/", "Accueil"), // l'accueil lui-même
        link("https://ailleurs.com/offres", "Partenaire"),
        link("https://www.site.com/brochure.pdf", "Brochure"),
        link("https://www.site.com/wp-login.php", "Connexion"),
        link("https://www.site.com/mentions-legales", "Mentions légales"),
        link("https://www.site.com/blog/page/2", "Page 2"),
        link("mailto:a@site.com", "E-mail"),
      ],
      [],
    );
    expect(selected).toEqual([{ url: "https://site.com/offres", role: "offer", source: "home" }]);
  });

  it("priorise contact, à propos, offres puis références et respecte les quotas", () => {
    const links = [
      ...Array.from({ length: 8 }, (_, i) => link(`${HOME}blog/article-${i}`, "Article")),
      ...Array.from({ length: 7 }, (_, i) => link(`${HOME}offres/offre-${i}`, "Offre")),
      link(`${HOME}contact`, "Contact"),
      link(`${HOME}a-propos`, "À propos"),
      link(`${HOME}etudes-de-cas`, "Études de cas"),
    ];
    const selected = selectPages(HOME, links, [], 15);
    expect(selected).toHaveLength(14); // 15 pages accueil compris
    expect(selected.slice(0, 2).map((s) => s.role)).toEqual(["contact", "about"]);
    // Les quotas garantissent d'abord la couverture du parcours…
    expect(selected.slice(0, 10).map((s) => s.role)).toEqual([
      "contact", "about", "offer", "offer", "offer", "offer", "offer", "case_study", "blog", "blog",
    ]);
    // …puis les places restantes sont complétées dans le même ordre de priorité.
    expect(selected.filter((s) => s.role === "offer")).toHaveLength(7);
    expect(selected.filter((s) => s.role === "blog")).toHaveLength(4);
  });

  it("complète avec le plan du site et respecte une limite plus basse", () => {
    const selected = selectPages(HOME, [link(`${HOME}contact`, "Contact")], [`${HOME}faq`, `${HOME}services/audit`, `${HOME}contact/`], 3);
    expect(selected.map((s) => [s.url, s.role, s.source])).toEqual([
      [`${HOME}contact`, "contact", "home"],
      [`${HOME}services/audit`, "offer", "sitemap"],
    ]);
  });

  it("pageKey ignore www, ancre, paramètres et / final", () => {
    expect(pageKey(new URL("https://www.site.com/a/?x=1#y"))).toBe(pageKey(new URL("https://site.com/a")));
  });
});
