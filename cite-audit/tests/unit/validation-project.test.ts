import { describe, expect, it } from "vitest";
import {
  cleanText,
  normalizeSiteUrl,
  parseCompetitorLines,
  parseGeoQueryLines,
  projectFieldErrors,
  projectFormDataToValues,
  projectFormSchema,
} from "@/lib/validation/project";

const validForm = {
  companyName: "  Data & AI Academy ",
  siteUrl: "dataaiacademy.com",
  sector: "Conseil SEO/GEO",
  country: "CI",
  city: "Abidjan",
  primaryTarget: "Dirigeants de PME B2B",
  competitors: "Concurrent A\nConcurrent B | https://concurrent-b.com/",
  geoQueries: "Quelle agence GEO choisir à Abidjan ?",
  ownershipAttested: "on",
};

describe("normalizeSiteUrl", () => {
  it.each([
    ["exemple.com", "https://exemple.com/", "exemple.com"],
    ["https://WWW.Exemple.com", "https://www.exemple.com/", "www.exemple.com"],
    ["http://exemple.com/offres/?utm=1#top", "http://exemple.com/offres", "exemple.com"],
    ["https://exemple.co.uk/fr/", "https://exemple.co.uk/fr", "exemple.co.uk"],
    ["  https://exemple.com.  ", "https://exemple.com/", "exemple.com"],
  ])("accepte et normalise %s", (input, url, domain) => {
    expect(normalizeSiteUrl(input)).toEqual({ ok: true, value: { url, domain } });
  });

  it.each([
    ["", "Indiquez"],
    ["ftp://exemple.com", "http"],
    ["javascript:alert(1)", "invalide|http"],
    ["https://user:pass@exemple.com", "identifiant"],
    ["https://exemple.com:8080", "ports"],
    ["http://127.0.0.1", "adresse IP"],
    ["http://169.254.169.254/latest/meta-data", "adresse IP"],
    ["http://[::1]/", "adresse IP"],
    ["http://localhost:3000", "ports"],
    ["http://localhost", "incomplet"],
    ["http://intranet.local", "réservé"],
    ["https://api.internal", "réservé"],
    ["https://exemple", "incomplet"],
    [`https://exemple.com/${"a".repeat(2100)}`, "trop longue"],
  ])("refuse %s", (input, expected) => {
    const result = normalizeSiteUrl(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(new RegExp(expected, "i"));
  });
});

describe("cleanText", () => {
  it("retire les caractères de contrôle et normalise les espaces", () => {
    expect(cleanText("  Data\u0000 &\t\tAI \n Academy ")).toBe("Data & AI Academy");
  });
});

describe("parseCompetitorLines", () => {
  it("lit nom seul ou nom | URL, ignore lignes vides et doublons", () => {
    const { value, errors } = parseCompetitorLines("A\n\nB | b.com\na\n");
    expect(errors).toEqual([]);
    expect(value).toEqual([{ name: "A" }, { name: "B", url: "https://b.com/" }]);
  });

  it("signale une URL invalide avec le numéro de ligne", () => {
    const { errors } = parseCompetitorLines("A | http://10.0.0.1");
    expect(errors[0]).toMatch(/^Ligne 1 : .*adresse IP/);
  });

  it("limite à 10 concurrents", () => {
    const raw = Array.from({ length: 12 }, (_, i) => `C${i}`).join("\n");
    const { value, errors } = parseCompetitorLines(raw);
    expect(value).toHaveLength(10);
    expect(errors).toContain("10 concurrents maximum.");
  });
});

describe("parseGeoQueryLines", () => {
  it("déduplique sans tenir compte de la casse", () => {
    expect(parseGeoQueryLines("Quel CRM ?\nquel crm ?\nMeilleur ERP").value).toEqual(["Quel CRM ?", "Meilleur ERP"]);
  });

  it("refuse les requêtes trop courtes ou trop longues", () => {
    const { errors } = parseGeoQueryLines(`ab\n${"x".repeat(301)}`);
    expect(errors).toHaveLength(2);
  });

  it("limite à 20 requêtes", () => {
    const raw = Array.from({ length: 21 }, (_, i) => `Requête numéro ${i}`).join("\n");
    expect(parseGeoQueryLines(raw).errors).toContain("20 requêtes maximum.");
  });
});

describe("projectFormSchema", () => {
  it("transforme un formulaire valide en données normalisées", () => {
    const result = projectFormSchema.safeParse(validForm);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      companyName: "Data & AI Academy",
      siteUrl: "https://dataaiacademy.com/",
      domain: "dataaiacademy.com",
      sector: "Conseil SEO/GEO",
      country: "CI",
      city: "Abidjan",
      primaryTarget: "Dirigeants de PME B2B",
      competitors: [{ name: "Concurrent A" }, { name: "Concurrent B", url: "https://concurrent-b.com/" }],
      geoQueries: ["Quelle agence GEO choisir à Abidjan ?"],
    });
  });

  it("accepte les champs facultatifs vides (ville → null)", () => {
    const result = projectFormSchema.safeParse({ ...validForm, city: "", competitors: "", geoQueries: "" });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ city: null, competitors: [], geoQueries: [] });
  });

  it("exige l'attestation d'autorisation", () => {
    const result = projectFormSchema.safeParse({ ...validForm, ownershipAttested: undefined });
    expect(result.success).toBe(false);
    expect(projectFieldErrors(result.error!).ownershipAttested?.[0]).toMatch(/autorisé/);
  });

  it("refuse un pays hors liste", () => {
    const result = projectFormSchema.safeParse({ ...validForm, country: "XX" });
    expect(projectFieldErrors(result.error!).country).toEqual(["Choisissez un pays."]);
  });

  it("regroupe toutes les erreurs par champ en une seule passe", () => {
    const result = projectFormSchema.safeParse({
      ...validForm,
      companyName: "A",
      siteUrl: "http://192.168.1.1",
      primaryTarget: "",
      competitors: "X | pas une url",
    });
    expect(result.success).toBe(false);
    const errors = projectFieldErrors(result.error!);
    expect(Object.keys(errors).sort()).toEqual(["companyName", "competitors", "primaryTarget", "siteUrl"]);
  });

  it("n'accepte que les champs connus du FormData", () => {
    const fd = new FormData();
    fd.set("companyName", "X");
    fd.set("isDemo", "true");
    fd.set("userId", "autre-utilisateur");
    const values = projectFormDataToValues(fd);
    expect(values).not.toHaveProperty("isDemo");
    expect(values).not.toHaveProperty("userId");
    expect(values.city).toBe("");
    expect(values.ownershipAttested).toBeUndefined();
  });
});
