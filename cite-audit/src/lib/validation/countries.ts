/** Pays proposés dans le formulaire (code ISO 3166-1 alpha-2). Liste extensible. */
export const COUNTRIES = [
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "FR", name: "France" },
  { code: "BE", name: "Belgique" },
  { code: "CH", name: "Suisse" },
  { code: "CA", name: "Canada" },
  { code: "LU", name: "Luxembourg" },
  { code: "MA", name: "Maroc" },
  { code: "TN", name: "Tunisie" },
  { code: "DZ", name: "Algérie" },
  { code: "SN", name: "Sénégal" },
  { code: "CM", name: "Cameroun" },
  { code: "BF", name: "Burkina Faso" },
  { code: "ML", name: "Mali" },
  { code: "BJ", name: "Bénin" },
  { code: "TG", name: "Togo" },
  { code: "GA", name: "Gabon" },
  { code: "CD", name: "RD Congo" },
  { code: "CG", name: "Congo" },
  { code: "GN", name: "Guinée" },
  { code: "NE", name: "Niger" },
  { code: "MG", name: "Madagascar" },
  { code: "MU", name: "Maurice" },
  { code: "RW", name: "Rwanda" },
  { code: "GB", name: "Royaume-Uni" },
  { code: "US", name: "États-Unis" },
  { code: "DE", name: "Allemagne" },
  { code: "ES", name: "Espagne" },
  { code: "IT", name: "Italie" },
  { code: "PT", name: "Portugal" },
  { code: "NL", name: "Pays-Bas" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as [CountryCode, ...CountryCode[]];
