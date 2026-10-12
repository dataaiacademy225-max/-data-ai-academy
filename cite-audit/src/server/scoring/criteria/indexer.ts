import type { JsonLdBlock } from "@/server/crawler/types";
import { mentionsCompany } from "@/server/scoring/criteria/clarifier";
import {
  contentUnreadable,
  isAccessDenied,
  fail,
  homeEvidence,
  homeNotVerified,
  notApplicable,
  notVerified,
  partial,
  pass,
  share,
  type Rule,
  type SiteView,
} from "@/server/scoring/criteria/shared";
import { containsPhrase, truncate } from "@/server/scoring/text";
import type { Evidence } from "@/server/scoring/types";

const pagesEvidence = (view: SiteView, pick: (p: SiteView["okPages"][number]) => string | null, label: string): Evidence[] =>
  view.okPages.slice(0, 5).map((p) => ({ url: p.analysis.finalUrl, label, excerpt: pick(p) ?? "absent" }));

export const I1: Rule = (view) => {
  // 401 / 403 / 429 : accès refusé à notre robot (pare-feu, protection anti-robot, limite de débit).
  // Un visiteur voit peut-être la page normalement : on ne conclut rien.
  if (view.homeError?.code === "HTTP_ERROR" && isAccessDenied(view.homeError.httpStatus)) {
    return homeNotVerified(view);
  }
  if (view.homeError?.code === "HTTP_ERROR") {
    return fail(
      `La page d'accueil répond par une erreur (code HTTP ${view.homeError.httpStatus}).`,
      ["Une page d'accueil qui répond normalement (code 200)"],
      [{ url: view.homeError.url, label: `Code HTTP ${view.homeError.httpStatus}` }],
      "HIGH",
      "CRITIQUE",
    );
  }
  if (!view.home) return homeNotVerified(view);
  const h = view.home;
  const noindex = h.facts.robotsMeta.noindex || /noindex|none/i.test(h.xRobotsTag ?? "");
  const evidence = [
    homeEvidence(view, `Code HTTP ${h.httpStatus}`),
    ...h.redirectChain.map((r) => ({ url: r.url, label: `Redirection ${r.status}` })),
  ];
  if (noindex) {
    return fail("La page d'accueil demande aux moteurs de ne pas l'indexer (noindex).", ["Retirer la consigne noindex"], [...evidence, homeEvidence(view, "Consigne robots", h.facts.robotsMeta.raw.join(", ") || (h.xRobotsTag ?? undefined))], "HIGH", "CRITIQUE");
  }
  const issues: string[] = [];
  if (!h.finalUrl.startsWith("https://")) issues.push("La page n'est pas servie en HTTPS");
  if (h.redirectChain.length > 1) issues.push(`${h.redirectChain.length} redirections avant d'arriver à la page`);
  if (issues.length > 0) return partial(0.5, `La page d'accueil répond, mais : ${issues.join(" ; ").toLowerCase()}.`, issues, evidence);
  return pass(`La page d'accueil répond normalement (code ${h.httpStatus}) en HTTPS${h.redirectChain.length ? " après une redirection" : ""}.`, evidence);
};

export const I2: Rule = (view) => {
  if (view.homeError?.code === "ROBOTS_DISALLOWED") {
    return notVerified("Non vérifié : robots.txt a empêché notre analyse, mais ses règles exactes pour Google et les IA n'ont pas été lues.");
  }
  if (!view.home) return homeNotVerified(view);
  const evidence = [homeEvidence(view, "robots.txt")];
  if (view.home.robotsTxt === "NO_ROBOTS_TXT") {
    return partial(0.5, "Aucun fichier robots.txt : tout est lisible par défaut, mais aucun plan de site n'y est signalé.", ["Un fichier robots.txt qui signale le plan du site"], evidence, "HIGH", "RECOMMANDE");
  }
  return pass("Le fichier robots.txt existe et autorise la lecture de la page d'accueil. Les règles propres à chaque robot d'IA ne sont pas détaillées dans cette version.", evidence);
};

export const I3: Rule = (view) => {
  const sitemap = view.input.site.sitemap;
  if (!sitemap) return notVerified("Non vérifié : le plan du site n'a pas pu être vérifié lors de cet audit.");
  if (!sitemap.found) return fail("Aucun plan du site (sitemap.xml) n'a été trouvé.", ["Un fichier sitemap.xml"]);
  if (!sitemap.validXml || sitemap.urlCount === 0) return partial(0.5, "Un plan du site existe mais il est invalide ou vide.", ["Un sitemap.xml valide listant vos pages"]);
  return pass(`Un plan du site valide liste ${sitemap.urlCount} adresses.`);
};

function lengthRule(
  view: SiteView,
  read: (facts: SiteView["okPages"][number]["analysis"]["facts"]) => string | null,
  min: number,
  max: number,
  name: string,
  label: string,
) {
  if (view.okPages.length === 0) return homeNotVerified(view);
  const values = view.okPages.map((p) => read(p.analysis.facts));
  const present = values.filter((v): v is string => Boolean(v));
  const good = present.filter((v) => v.length >= min && v.length <= max);
  const unique = new Set(present.map((v) => v.toLowerCase())).size === present.length;
  const total = view.okPages.length;
  const evidence = pagesEvidence(view, (p) => {
    const v = read(p.analysis.facts);
    return v ? `${truncate(v, 120)} (${v.length} caractères)` : null;
  }, label);
  if (present.length === 0) return fail(`Aucune ${name} sur ${total === 1 ? "la page analysée" : "les pages analysées"}.`, [`Une ${name} de ${min} à ${max} caractères`], evidence);
  if (good.length === total && unique) return pass(`${total === 1 ? "La" : "Chaque"} ${name} fait entre ${min} et ${max} caractères${total > 1 ? " et est unique" : ""}.`, evidence);
  if (total === 1) {
    return partial(0.3, `La ${name} existe mais fait ${present[0].length} caractères (conseillé : ${min} à ${max}).`, [`Une ${name} de ${min} à ${max} caractères`], evidence);
  }
  const missing: string[] = [];
  if (present.length < total) missing.push(`${total - present.length} page(s) sans ${name}`);
  if (good.length < present.length) missing.push(`${present.length - good.length} ${name}(s) hors de ${min} à ${max} caractères`);
  if (!unique) missing.push(`Des ${name}s identiques sur plusieurs pages`);
  return partial(Math.max(0.3, share(good.length, total)), `${good.length} ${name}(s) sur ${total} respectent la longueur conseillée (${min} à ${max} caractères).`, missing, evidence);
}

export const I4: Rule = (view) => lengthRule(view, (f) => f.title, 30, 65, "titre de page", "Titre (title)");
export const I5: Rule = (view) => lengthRule(view, (f) => f.metaDescription, 70, 160, "description de page", "Meta description");

export const I6: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const total = view.okPages.length;
  const good = view.okPages.filter((p) => p.analysis.facts.h1.length === 1 && p.analysis.facts.h2.length > 0).length;
  const evidence = view.okPages.slice(0, 5).map((p) => ({
    url: p.analysis.finalUrl,
    label: `${p.analysis.facts.h1.length} H1, ${p.analysis.facts.h2.length} H2`,
  }));
  if (good === total) return pass("Chaque page analysée a un titre principal unique et des sous-titres.", evidence);
  if (good > 0) return partial(share(good, total), `${good} page(s) sur ${total} ont un titre principal unique et des sous-titres.`, ["Un H1 et des H2 sur chaque page"], evidence);
  return fail("Aucune page analysée n'a à la fois un titre principal unique et des sous-titres.", ["Un H1 unique et des H2 sur chaque page"], evidence);
};

export const I7: Rule = (view) => {
  if (view.okPages.length === 0) return homeNotVerified(view);
  const total = view.okPages.length;
  let good = 0;
  const missing: string[] = [];
  for (const p of view.okPages) {
    const canon = p.analysis.facts.canonical;
    if (canon.length === 0) {
      missing.push("Page sans adresse de référence");
      continue;
    }
    if (canon.length > 1) {
      missing.push("Plusieurs adresses de référence sur une même page");
      continue;
    }
    if (new URL(canon[0]).hostname.replace(/^www\./, "") !== new URL(p.analysis.finalUrl).hostname.replace(/^www\./, "")) {
      missing.push("Adresse de référence vers un autre domaine");
      continue;
    }
    good += 1;
  }
  const evidence = pagesEvidence(view, (p) => p.analysis.facts.canonical.join(", ") || null, "Canonical");
  if (good === total) return pass("Chaque page analysée déclare une adresse de référence sur votre domaine.", evidence);
  if (good > 0) return partial(share(good, total), `${good} page(s) sur ${total} déclarent une adresse de référence correcte.`, [...new Set(missing)], evidence);
  return fail("Aucune adresse de référence (canonical) correcte n'a été trouvée.", [...new Set(missing)], evidence);
};

export const I8: Rule = (view) => {
  if (!view.home) return homeNotVerified(view);
  const { wordCount } = view.home.facts.visibleText;
  const evidence = [homeEvidence(view, `${wordCount} mots visibles dans le code reçu`)];
  if (wordCount < 50 || view.home.facts.likelyClientRendered) {
    return fail(
      `La page d'accueil ne contient que ${wordCount} mots lisibles sans JavaScript${view.home.facts.likelyClientRendered ? " : son contenu semble affiché par JavaScript" : ""}.`,
      ["Au moins 200 mots utiles présents dans le HTML envoyé"],
      evidence,
      "HIGH",
      "CRITIQUE",
    );
  }
  if (wordCount < 200) return partial(0.5, `La page d'accueil contient ${wordCount} mots lisibles : c'est peu pour décrire votre offre (objectif : 200).`, ["Au moins 200 mots utiles"], evidence);
  return pass(`La page d'accueil contient ${wordCount} mots lisibles directement.`, evidence);
};

const ENTITY_TYPE = /^(Organization|Corporation|ProfessionalService|LocalBusiness|NGO|EducationalOrganization|OnlineBusiness|OnlineStore)$|(Business|Service|Organization)$/;

/** Cherche dans le JSON-LD un objet décrivant l'entreprise. */
function findEntity(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6 || !node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findEntity(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = node as Record<string, unknown>;
  const types = ([] as unknown[]).concat(record["@type"] ?? []).filter((t): t is string => typeof t === "string");
  if (types.some((t) => ENTITY_TYPE.test(t))) return record;
  for (const value of Object.values(record)) {
    const found = findEntity(value, depth + 1);
    if (found) return found;
  }
  return null;
}

function entityOf(blocks: JsonLdBlock[]): { entity: Record<string, unknown> | null; typeOnly: string | null } {
  for (const block of blocks) {
    if (!block.valid) continue;
    const entity = findEntity(block.data);
    if (entity) return { entity, typeOnly: null };
    const t = block.types.find((x) => ENTITY_TYPE.test(x));
    if (t) return { entity: null, typeOnly: t };
  }
  return { entity: null, typeOnly: null };
}

export const I9: Rule = (view) => {
  if (!view.home) return homeNotVerified(view);
  const blocks = view.okPages.flatMap((p) => p.analysis.facts.jsonLd);
  const invalid = blocks.filter((b) => !b.valid).length;
  const invalidNote = invalid ? ` ${invalid} bloc(s) JSON-LD invalide(s) ignoré(s).` : "";
  const evidence: Evidence[] = blocks.slice(0, 4).map((b) => ({
    url: view.home?.finalUrl,
    label: b.valid ? `JSON-LD : ${b.types.join(", ") || "type non précisé"}` : "JSON-LD invalide",
    excerpt: b.valid ? undefined : b.excerpt,
  }));
  if (blocks.length === 0) {
    return fail("Aucune donnée structurée (JSON-LD) n'a été trouvée.", ["Un bloc JSON-LD Organization avec nom, site, logo et profils (sameAs)"], [homeEvidence(view, "Aucun JSON-LD")]);
  }
  const { entity, typeOnly } = entityOf(blocks);
  if (!entity && !typeOnly) {
    return fail(`Des données structurées existent, mais aucune ne décrit l'entreprise elle-même.${invalidNote}`, ["Un bloc JSON-LD Organization (ou ProfessionalService / LocalBusiness)"], evidence);
  }
  if (!entity) {
    return partial(0.5, `L'entreprise est déclarée (${typeOnly}), mais le bloc est trop volumineux pour vérifier son contenu.${invalidNote}`, ["Nom, site, logo et profils non vérifiés"], evidence, "MEDIUM");
  }
  const props = { name: "nom", url: "adresse du site", logo: "logo", sameAs: "liens vers vos profils (sameAs)" } as const;
  const missing = Object.entries(props).filter(([key]) => !entity[key]).map(([, label]) => label);
  const present = 4 - missing.length;
  if (missing.length === 0) return pass(`L'entreprise est déclarée avec son nom, son site, son logo et ses profils.${invalidNote}`, evidence);
  return partial(0.5 + 0.5 * (present / 4), `L'entreprise est déclarée, mais il manque : ${missing.join(", ")}.${invalidNote}`, missing, evidence);
};

export const I10: Rule = (view) => {
  if (!view.home) return homeNotVerified(view);
  const og = view.home.facts.openGraph;
  const keys = ["og:title", "og:description", "og:image"];
  const missing = keys.filter((k) => !og[k]);
  const evidence = keys.filter((k) => og[k]).map((k) => homeEvidence(view, k, og[k]));
  if (missing.length === 0) return pass("Titre, description et image de partage sont renseignés.", evidence);
  if (missing.length < keys.length) return partial(share(keys.length - missing.length, keys.length), `Aperçu de partage incomplet : il manque ${missing.join(", ")}.`, missing, evidence);
  return fail("Aucune balise de partage (Open Graph) n'est renseignée.", missing, [homeEvidence(view, "Aucune balise Open Graph")]);
};

export const I11: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const total = view.okPages.reduce((n, p) => n + p.analysis.facts.images.total, 0);
  const missingAlt = view.okPages.reduce((n, p) => n + p.analysis.facts.images.missingAlt, 0);
  if (total === 0) return notApplicable("Sans objet : aucune image sur les pages analysées.");
  const ratio = 1 - missingAlt / total;
  const evidence = [homeEvidence(view, `${total - missingAlt} image(s) décrite(s) sur ${total}`)];
  if (ratio >= 0.9) return pass(`${Math.round(ratio * 100)} % des images ont un texte alternatif.`, evidence);
  if (ratio >= 0.5) return partial(ratio, `${missingAlt} image(s) sur ${total} n'ont pas de texte alternatif.`, [`${missingAlt} texte(s) alternatif(s) manquant(s)`], evidence);
  return fail(`${missingAlt} image(s) sur ${total} n'ont pas de texte alternatif.`, [`${missingAlt} texte(s) alternatif(s) manquant(s)`], evidence);
};

export const I12: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const count = view.home.facts.internalLinks.length;
  const broken = view.input.site.brokenLinks;
  const evidence = [homeEvidence(view, `${count} lien(s) interne(s) depuis l'accueil`)];
  const brokenNote = broken
    ? broken.broken.length
      ? ` ${broken.broken.length} lien(s) cassé(s) sur ${broken.checked} testés.`
      : ` Aucun lien cassé sur ${broken.checked} testés.`
    : " Les liens cassés ne sont pas encore vérifiés dans cette version.";
  if (count === 0) return fail(`La page d'accueil ne renvoie vers aucune autre page du site.${brokenNote}`, ["Des liens vers vos pages clés"], evidence);
  if (broken && broken.broken.length > 0) {
    return partial(0.5, `La page d'accueil relie ${count} page(s).${brokenNote}`, broken.broken.slice(0, 5).map((u) => `Lien cassé : ${u}`), evidence);
  }
  if (count < 5) return partial(0.5, `La page d'accueil ne relie que ${count} page(s) du site.${brokenNote}`, ["Au moins 5 liens vers vos pages clés"], evidence);
  return pass(`La page d'accueil relie ${count} pages du site.${brokenNote}`, evidence);
};

export const I13: Rule = (view) => {
  const unreadable = contentUnreadable(view);
  if (unreadable || !view.home) return unreadable ?? homeNotVerified(view);
  const { companyName, city } = view.input.context;
  const f = view.home.facts;
  const { entity } = entityOf(f.jsonLd);
  const entityName = typeof entity?.name === "string" ? entity.name : null;
  const checks: { label: string; ok: boolean }[] = [
    { label: "Nom dans le titre de la page", ok: mentionsCompany(f.title ?? "", companyName) },
    { label: "Nom dans le texte de la page", ok: mentionsCompany(f.visibleText.sample, companyName) },
  ];
  if (entityName !== null) checks.push({ label: "Nom identique dans les données structurées", ok: mentionsCompany(entityName, companyName) });
  if (city) {
    checks.push({
      label: `Ville (${city}) mentionnée`,
      ok: containsPhrase(`${f.visibleText.sample} ${JSON.stringify(entity ?? {})}`, city),
    });
  }
  const ok = checks.filter((c) => c.ok);
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  const evidence = checks.map((c) => homeEvidence(view, `${c.ok ? "✓" : "✗"} ${c.label}`));
  if (ok.length === checks.length) return pass(`« ${companyName} »${city ? ` et ${city}` : ""} apparaissent de façon cohérente.`, evidence, "MEDIUM");
  if (ok.length > 0) return partial(share(ok.length, checks.length), `Nom et localisation ne sont repris qu'en partie (${ok.length} vérification(s) sur ${checks.length}).`, missing, evidence, "MEDIUM");
  return fail(`Le nom « ${companyName} » n'apparaît ni dans le titre ni dans le texte de la page.`, missing, evidence, "MEDIUM");
};

export const I14: Rule = (view) => {
  const perf = view.input.site.performance;
  if (!perf) return notVerified("Non vérifié : la vitesse d'affichage n'est pas mesurée dans cette version.");
  const lcpOk = perf.lcpMs <= 2500;
  const clsOk = perf.cls <= 0.1;
  const evidence = [{ label: `Affichage principal : ${(perf.lcpMs / 1000).toFixed(1)} s ; stabilité : ${perf.cls}` }];
  if (lcpOk && clsOk) return pass("La page s'affiche rapidement et sans décalage.", evidence);
  if (lcpOk || clsOk) return partial(0.5, lcpOk ? "La page s'affiche vite mais des éléments bougent pendant le chargement." : "La page met plus de 2,5 s à afficher son contenu principal.", [lcpOk ? "Stabilité visuelle" : "Affichage en moins de 2,5 s"], evidence);
  return fail("La page est lente à s'afficher et instable pendant le chargement.", ["Affichage en moins de 2,5 s", "Stabilité visuelle"], evidence);
};
