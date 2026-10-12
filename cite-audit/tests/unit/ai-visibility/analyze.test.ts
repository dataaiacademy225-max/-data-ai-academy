import { describe, expect, it } from "vitest";
import { analyzeResponse, splitUnits } from "@/server/ai-visibility/analyze";
import type { AiSource } from "@/server/ai-visibility/types";

const brand = { name: "Cabinet Clair", url: "https://www.cabinet-clair.com/" };
const competitors = [
  { name: "Data Lagune", url: "https://datalagune.ci" },
  { name: "Atlas Conseil", url: null },
];
const src = (url: string): AiSource => ({ url, origin: "API" });

describe("mention, citation et recommandation sont distinguées", () => {
  it("mention seule : le nom apparaît, sans source ni recommandation", () => {
    const r = analyzeResponse("Plusieurs cabinets existent, dont Cabinet Clair et Data Lagune.", [], brand, competitors);
    expect(r.brand).toMatchObject({ mentioned: true, cited: false, recommended: false, detectedAs: "Cabinet Clair" });
  });

  it("citation : une source renvoyée pointe vers le site, même sans mention du nom", () => {
    const r = analyzeResponse("Voici quelques ressources utiles sur le sujet.", [src("https://cabinet-clair.com/blog/data")], brand, competitors);
    expect(r.brand).toMatchObject({ mentioned: false, cited: true, recommended: false });
  });

  it("recommandation : formulation explicite dans la même phrase", () => {
    const r = analyzeResponse("Pour une PME, je vous recommande Cabinet Clair. Data Lagune est aussi présent à Abidjan.", [], brand, competitors);
    expect(r.brand.recommended).toBe(true);
    expect(r.competitors.find((c) => c.name === "Data Lagune")).toMatchObject({ mentioned: true, recommended: false });
  });

  it("une recommandation qui vise un concurrent n'est pas attribuée à la marque", () => {
    const text = "Cabinet Clair existe depuis 2019. Je recommande plutôt Data Lagune pour ce besoin.";
    const r = analyzeResponse(text, [], brand, competitors);
    expect(r.brand).toMatchObject({ mentioned: true, recommended: false });
    expect(r.competitors[0]).toMatchObject({ mentioned: true, recommended: true });
  });

  it("point de liste : recommandation et position dans la liste", () => {
    const text = "Voici les meilleures options :\n1. Data Lagune — spécialiste des tableaux de bord.\n2. Cabinet Clair — meilleur choix pour les PME industrielles.\n3. Atlas Conseil.";
    const r = analyzeResponse(text, [], brand, competitors);
    expect(r.brand).toMatchObject({ mentioned: true, recommended: true, approxPosition: 2 });
    expect(r.brand.excerpt).toContain("Cabinet Clair — meilleur choix");
    expect(r.competitors.map((c) => [c.name, c.approxPosition])).toEqual([["Data Lagune", 1], ["Atlas Conseil", 3]]);
  });
});

describe("détection robuste du nom", () => {
  it("ignore la casse et les accents, reconnaît le domaine", () => {
    expect(analyzeResponse("CABINET CLAIR est cité.", [], brand, []).brand.mentioned).toBe(true);
    expect(analyzeResponse("Voir www.cabinet-clair.com pour les tarifs.", [], brand, []).brand).toMatchObject({ mentioned: true, detectedAs: "cabinet-clair.com" });
    const accents = analyzeResponse("L'équipe d'Évolution Data intervient.", [], { name: "Evolution Data" }, []);
    expect(accents.brand.mentioned).toBe(true);
  });

  it("ne confond pas un mot plus long (frontières de mot)", () => {
    expect(analyzeResponse("Le Cabinet Clairvoyance est réputé.", [], brand, []).brand.mentioned).toBe(false);
  });

  it("nom court ou courant : fiabilité de lecture réduite", () => {
    const r = analyzeResponse("Un exposé clair et précis sur le sujet, avec Clair en exemple.", [], { name: "Clair" }, []);
    expect(r.brand.mentioned).toBe(true);
    expect(r.confidence).toBeLessThan(0.8);
  });
});

describe("sources", () => {
  it("garde les sources de l'API et ajoute seulement les adresses écrites dans le texte", () => {
    const r = analyzeResponse("Selon https://www.insee.fr/stats, la croissance est forte.", [src("https://datalagune.ci/etude")], brand, competitors);
    expect(r.sources).toEqual([
      { url: "https://datalagune.ci/etude", origin: "API" },
      { url: "https://www.insee.fr/stats", origin: "TEXT" },
    ]);
    expect(r.competitors[0].cited).toBe(true);
  });

  it("n'invente aucune source", () => {
    expect(analyzeResponse("Cabinet Clair est un cabinet de conseil.", [], brand, []).sources).toEqual([]);
  });
});

describe("intégrité", () => {
  it("ne modifie ni le texte ni les sources reçus", () => {
    const text = "  Cabinet Clair\n\n**gras** <script>x</script> ";
    const sources = [src("https://cabinet-clair.com")];
    const copy = JSON.stringify(sources);
    analyzeResponse(text, sources, brand, competitors);
    expect(text).toBe("  Cabinet Clair\n\n**gras** <script>x</script> ");
    expect(JSON.stringify(sources)).toBe(copy);
  });

  it("splitUnits découpe en points de liste ou en phrases", () => {
    expect(splitUnits("A. B ! C ?").map((u) => u.text.trim())).toEqual(["A.", "B !", "C ?"]);
    expect(splitUnits("Intro\n- un\n- deux").map((u) => u.text)).toEqual(["- un", "- deux"]);
  });
});
