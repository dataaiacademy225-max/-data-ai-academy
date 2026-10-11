import { isIP } from "node:net";
import { RESERVED_TLDS } from "@/lib/validation/project";
import type { CrawlError, NetworkPolicy, ResolvedAddress, Result } from "@/server/crawler/types";

const MAX_URL_LENGTH = 2048;
const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback"]);

/** URL sans identifiants, paramètres ni ancre : seule forme autorisée dans les journaux et les erreurs. */
export function redactUrl(url: string | URL): string {
  try {
    const u = new URL(url.toString());
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return "[url invalide]";
  }
}

function fail(code: CrawlError["code"], message: string, url?: string): Result<never> {
  return { ok: false, error: { code, message, url: url ? redactUrl(url) : undefined } };
}

function effectivePort(url: URL): number {
  if (url.port) return Number(url.port);
  return url.protocol === "https:" ? 443 : 80;
}

/**
 * Contrôle syntaxique d'une URL cible, sans réseau.
 * Les adresses IP littérales sont vérifiées ici (elles ne passent pas par le DNS).
 */
export function checkUrl(raw: string | URL, policy: Pick<NetworkPolicy, "isAllowedAddress" | "allowedPorts">): Result<URL> {
  const input = typeof raw === "string" ? raw.trim() : raw.toString();
  if (!input || input.length > MAX_URL_LENGTH) return fail("INVALID_URL", "Adresse vide ou trop longue.");

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return fail("INVALID_URL", "Adresse mal formée.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return fail("INVALID_URL", "Seules les adresses http:// et https:// sont analysées.");
  }
  if (url.username || url.password) {
    return fail("BLOCKED_PRIVATE", "Les adresses avec identifiants ne sont pas analysées.", url.toString());
  }
  if (!policy.allowedPorts.includes(effectivePort(url))) {
    return fail("BLOCKED_PRIVATE", "Port non autorisé.", url.toString());
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) return fail("INVALID_URL", "Nom d'hôte manquant.");

  if (isIP(host)) {
    return policy.isAllowedAddress(host)
      ? { ok: true, value: url }
      : fail("BLOCKED_PRIVATE", "Adresse IP privée, locale ou réservée.", url.toString());
  }
  // Les formes numériques ambiguës (ex. 2130706433, 0x7f.1) sont normalisées par URL ;
  // un hôte purement numérique restant est refusé par prudence.
  if (/^[\d.]+$/.test(host) || /^0x/i.test(host)) {
    return fail("BLOCKED_PRIVATE", "Adresse IP non standard.", url.toString());
  }
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost")) {
    return fail("BLOCKED_PRIVATE", "Adresse locale.", url.toString());
  }
  const labels = host.split(".");
  if (labels.length < 2) return fail("BLOCKED_PRIVATE", "Nom d'hôte interne (sans domaine public).", url.toString());
  if (RESERVED_TLDS.has(labels[labels.length - 1])) {
    return fail("BLOCKED_PRIVATE", "Domaine interne ou réservé.", url.toString());
  }
  return { ok: true, value: url };
}

/**
 * Résout un nom d'hôte et vérifie TOUTES les adresses obtenues.
 * Une seule adresse privée suffit à bloquer (évite les réponses DNS mixtes).
 */
export async function resolveAllowed(hostname: string, policy: NetworkPolicy): Promise<Result<ResolvedAddress[]>> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    return policy.isAllowedAddress(host)
      ? { ok: true, value: [{ address: host, family: isIP(host) as 4 | 6 }] }
      : fail("BLOCKED_PRIVATE", "Adresse IP privée, locale ou réservée.");
  }
  let addresses: ResolvedAddress[];
  try {
    addresses = await policy.resolve(host);
  } catch {
    return fail("DNS_ERROR", "Nom de domaine introuvable.");
  }
  if (addresses.length === 0) return fail("DNS_ERROR", "Nom de domaine introuvable.");
  if (addresses.some((a) => !policy.isAllowedAddress(a.address))) {
    return fail("BLOCKED_PRIVATE", "Le domaine pointe vers une adresse privée, locale ou réservée.");
  }
  return { ok: true, value: addresses };
}
