import { z } from "zod";
import { COUNTRY_CODES } from "@/lib/validation/countries";

/**
 * Schémas partagés client + serveur pour le formulaire de projet.
 * Le client s'en sert pour un retour immédiat ; le serveur revalide toujours (seule validation fiable).
 */

export const PROJECT_LIMITS = {
  companyName: { min: 2, max: 120 },
  sector: { min: 2, max: 80 },
  city: { max: 80 },
  primaryTarget: { min: 3, max: 200 },
  competitors: { max: 10, nameMax: 120 },
  geoQueries: { max: 20, min: 3, itemMax: 300 },
  url: { max: 2048 },
} as const;

// Domaines de premier niveau réservés ou internes : jamais un site public auditable.
export const RESERVED_TLDS: ReadonlySet<string> = new Set([
  "localhost",
  "local",
  "internal",
  "intranet",
  "lan",
  "home",
  "corp",
  "private",
  "test",
  "invalid",
  "example",
  "onion",
]);

// Retire les caractères de contrôle et normalise les espaces.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
}

export type NormalizedUrl = { url: string; domain: string };
export type UrlCheck = { ok: true; value: NormalizedUrl } | { ok: false; error: string };

/**
 * Vérifie et normalise l'URL d'un site public saisie par l'utilisateur.
 * Premier filtre seulement : la protection SSRF complète (résolution DNS, IP privées,
 * redirections) sera appliquée par le crawler au moment de chaque requête.
 */
export function normalizeSiteUrl(raw: string): UrlCheck {
  const input = cleanText(raw);
  if (!input) return { ok: false, error: "Indiquez l'adresse du site." };
  if (input.length > PROJECT_LIMITS.url.max) return { ok: false, error: "Adresse trop longue." };

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, error: "Adresse invalide. Exemple : https://www.monentreprise.com" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Seules les adresses http:// ou https:// sont acceptées." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "L'adresse ne doit pas contenir d'identifiant ni de mot de passe." };
  }
  if (parsed.port) {
    return { ok: false, error: "Les ports personnalisés ne sont pas acceptés." };
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("[") || /^[\d.]+$/.test(host) || host.includes(":")) {
    return { ok: false, error: "Indiquez un nom de domaine, pas une adresse IP." };
  }
  const labels = host.split(".");
  const tld = labels[labels.length - 1];
  if (labels.length < 2 || !/^[a-z]{2,63}$|^xn--[a-z0-9-]{1,59}$/.test(tld)) {
    return { ok: false, error: "Le nom de domaine semble incomplet (ex. monentreprise.com)." };
  }
  if (RESERVED_TLDS.has(tld)) {
    return { ok: false, error: "Ce domaine est interne ou réservé : seul un site public peut être audité." };
  }

  // On garde l'origine + le chemin ; paramètres et ancre sont ignorés.
  const path = parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/+$/, "");
  return { ok: true, value: { url: `${parsed.protocol}//${host}${path}`, domain: host } };
}

const requiredText = (label: string, min: number, max: number) =>
  z
    .string()
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(min, `${label} : ${min} caractères minimum.`)
        .max(max, `${label} : ${max} caractères maximum.`),
    );

export type Competitor = { name: string; url?: string };

/** Une ligne par concurrent : « Nom » ou « Nom | https://site.com ». */
export function parseCompetitorLines(raw: string): { value: Competitor[]; errors: string[] } {
  const errors: string[] = [];
  const seen = new Set<string>();
  const value: Competitor[] = [];
  const lines = raw.split(/\r?\n/).map(cleanText).filter(Boolean);

  if (lines.length > PROJECT_LIMITS.competitors.max) {
    errors.push(`${PROJECT_LIMITS.competitors.max} concurrents maximum.`);
  }

  lines.slice(0, PROJECT_LIMITS.competitors.max).forEach((line, index) => {
    const [namePart, urlPart, ...rest] = line.split("|").map(cleanText);
    const position = `Ligne ${index + 1}`;
    if (rest.length > 0) {
      errors.push(`${position} : utilisez une seule barre « | » entre le nom et l'adresse.`);
      return;
    }
    if (!namePart) {
      errors.push(`${position} : le nom du concurrent est manquant.`);
      return;
    }
    if (namePart.length > PROJECT_LIMITS.competitors.nameMax) {
      errors.push(`${position} : nom trop long.`);
      return;
    }
    const key = namePart.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    if (urlPart) {
      const check = normalizeSiteUrl(urlPart);
      if (!check.ok) {
        errors.push(`${position} : ${check.error}`);
        return;
      }
      value.push({ name: namePart, url: check.value.url });
    } else {
      value.push({ name: namePart });
    }
  });

  return { value, errors };
}

/** Une requête par ligne, doublons ignorés. */
export function parseGeoQueryLines(raw: string): { value: string[]; errors: string[] } {
  const { max, min, itemMax } = PROJECT_LIMITS.geoQueries;
  const errors: string[] = [];
  const seen = new Set<string>();
  const value: string[] = [];
  const lines = raw.split(/\r?\n/).map(cleanText).filter(Boolean);

  if (lines.length > max) errors.push(`${max} requêtes maximum.`);

  lines.slice(0, max).forEach((line, index) => {
    if (line.length < min || line.length > itemMax) {
      errors.push(`Requête ${index + 1} : entre ${min} et ${itemMax} caractères.`);
      return;
    }
    const key = line.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    value.push(line);
  });

  return { value, errors };
}

const siteUrlField = z.string().transform((raw, ctx) => {
  const check = normalizeSiteUrl(raw);
  if (!check.ok) {
    ctx.addIssue({ code: "custom", message: check.error });
    return z.NEVER;
  }
  return check.value;
});

/** Champ « une valeur par ligne » : chaque erreur de ligne devient une erreur du champ. */
function linesField<T>(parse: (raw: string) => { value: T[]; errors: string[] }) {
  return z
    .string()
    .optional()
    .default("")
    .transform((raw, ctx) => {
      const { value, errors } = parse(raw);
      for (const message of errors) ctx.addIssue({ code: "custom", message });
      return value;
    });
}

/**
 * Valeurs brutes du formulaire (toutes en texte, comme dans un FormData).
 * Chaque contrôle est porté par son champ pour que toutes les erreurs s'affichent en une seule fois.
 */
export const projectFormSchema = z
  .object({
    companyName: requiredText(
      "Nom de l'entreprise",
      PROJECT_LIMITS.companyName.min,
      PROJECT_LIMITS.companyName.max,
    ),
    siteUrl: siteUrlField,
    sector: requiredText("Secteur", PROJECT_LIMITS.sector.min, PROJECT_LIMITS.sector.max),
    country: z.enum(COUNTRY_CODES, "Choisissez un pays."),
    city: z
      .string()
      .optional()
      .default("")
      .transform(cleanText)
      .pipe(z.string().max(PROJECT_LIMITS.city.max, "Ville : 80 caractères maximum.")),
    primaryTarget: requiredText(
      "Cible principale",
      PROJECT_LIMITS.primaryTarget.min,
      PROJECT_LIMITS.primaryTarget.max,
    ),
    competitors: linesField(parseCompetitorLines),
    geoQueries: linesField(parseGeoQueryLines),
    ownershipAttested: z.literal("on", "Vous devez confirmer être autorisé à auditer ce site."),
  })
  .transform((form) => ({
    companyName: form.companyName,
    siteUrl: form.siteUrl.url,
    domain: form.siteUrl.domain,
    sector: form.sector,
    country: form.country,
    city: form.city || null,
    primaryTarget: form.primaryTarget,
    competitors: form.competitors,
    geoQueries: form.geoQueries,
  }));

export type ProjectFormValues = z.input<typeof projectFormSchema>;
export type ProjectInput = z.output<typeof projectFormSchema>;
export type ProjectFieldErrors = Partial<Record<keyof ProjectFormValues, string[]>>;

/** Erreurs regroupées par champ, prêtes à afficher. */
export function projectFieldErrors(error: z.ZodError): ProjectFieldErrors {
  const out: ProjectFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof ProjectFormValues | undefined;
    if (!field) continue;
    (out[field] ??= []).push(issue.message);
  }
  return out;
}

/** Convertit un FormData en valeurs brutes (seuls les champs connus sont lus). */
export function projectFormDataToValues(formData: FormData): Record<string, string | undefined> {
  const keys: (keyof ProjectFormValues)[] = [
    "companyName",
    "siteUrl",
    "sector",
    "country",
    "city",
    "primaryTarget",
    "competitors",
    "geoQueries",
    "ownershipAttested",
  ];
  const values: Record<string, string | undefined> = {};
  for (const key of keys) {
    const v = formData.get(key);
    // Une case non cochée est absente du FormData ; un champ texte absent vaut "".
    values[key] = typeof v === "string" ? v : key === "ownershipAttested" ? undefined : "";
  }
  return values;
}
