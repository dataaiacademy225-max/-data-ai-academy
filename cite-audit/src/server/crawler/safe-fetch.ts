import "server-only";
import { promises as dns, type LookupAddress, type LookupOptions } from "node:dns";
import { Agent, request } from "undici";
import { isPublicAddress } from "@/server/crawler/ip-policy";
import type {
  CrawlError,
  CrawlErrorCode,
  FetchedResource,
  FetchLimits,
  NetworkPolicy,
  RedirectHop,
  Result,
} from "@/server/crawler/types";
import { checkUrl, redactUrl, resolveAllowed } from "@/server/crawler/url-guard";

export const USER_AGENT = "GriotCite/0.1 (audit de visibilite; Data & AI Academy; +https://audit.data-ai-academy.com)";

export const DEFAULT_LIMITS: FetchLimits = {
  timeoutMs: 10_000,
  maxBytes: 2 * 1024 * 1024,
  maxRedirects: 5,
};

export const defaultNetworkPolicy: NetworkPolicy = {
  resolve: async (hostname) => {
    const results = await dns.lookup(hostname, { all: true, verbatim: true });
    return results.map((r) => ({ address: r.address, family: r.family === 6 ? 6 : 4 }));
  },
  isAllowedAddress: isPublicAddress,
  allowedPorts: [80, 443],
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

class GuardError extends Error {
  constructor(readonly crawlError: CrawlError) {
    super(crawlError.message);
  }
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/**
 * Agent HTTP dont la résolution DNS passe par la politique réseau, AU MOMENT de la connexion :
 * l'adresse vérifiée est celle réellement utilisée (protection contre le DNS rebinding).
 */
function createGuardedAgent(policy: NetworkPolicy, timeoutMs: number): Agent {
  const lookup = (hostname: string, options: LookupOptions, callback: LookupCallback) => {
    resolveAllowed(hostname, policy).then((result) => {
      if (!result.ok) {
        const err = Object.assign(new Error(result.error.message), { code: `CITE_${result.error.code}` });
        callback(err, "");
        return;
      }
      if (options.all) callback(null, result.value);
      else callback(null, result.value[0].address, result.value[0].family);
    }, () => callback(Object.assign(new Error("DNS"), { code: "CITE_DNS_ERROR" }), ""));
  };
  return new Agent({
    connect: { lookup: lookup as never, timeout: timeoutMs },
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
    connections: 2,
  });
}

/** Abandonne un corps de réponse sans le lire (l'annulation émet une erreur qu'on ignore volontairement). */
function discard(body: NodeJS.ReadableStream & { destroy: () => void }) {
  body.on("error", () => {});
  body.destroy();
}

function error(code: CrawlErrorCode, message: string, url?: URL | string, httpStatus?: number): Result<never> {
  return { ok: false, error: { code, message, url: url ? redactUrl(url) : undefined, httpStatus } };
}

function errorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

/** Traduit une exception réseau en erreur nommée, sans message technique brut. */
function mapError(err: unknown, url: URL, timedOut: boolean): Result<never> {
  if (err instanceof GuardError) return { ok: false, error: err.crawlError };
  const code = errorCode(err);
  if (timedOut || code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_BODY_TIMEOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
    return error("TIMEOUT", "Le site n'a pas répondu dans le délai imparti.", url);
  }
  if (code === "CITE_BLOCKED_PRIVATE") {
    return error("BLOCKED_PRIVATE", "Le domaine pointe vers une adresse privée, locale ou réservée.", url);
  }
  if (code === "CITE_DNS_ERROR" || code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return error("DNS_ERROR", "Nom de domaine introuvable.", url);
  }
  return error("NETWORK_ERROR", "Connexion au site impossible.", url);
}

/** Décode le corps selon le charset annoncé (en-tête, puis balise meta), UTF-8 par défaut. */
export function decodeBody(bytes: Uint8Array, contentType: string | null): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  for (const label of [fromHeader, fromMeta, "utf-8"]) {
    if (!label) continue;
    try {
      return new TextDecoder(label).decode(bytes);
    } catch {
      // charset inconnu : on essaie le suivant
    }
  }
  return new TextDecoder("utf-8").decode(bytes);
}

export type SafeFetchOptions = {
  policy?: NetworkPolicy;
  limits?: Partial<FetchLimits>;
  accept?: string;
  /** Appelé avant chaque requête (URL initiale et chaque redirection) : renvoyer une erreur l'interdit. */
  beforeRequest?: (url: URL) => Promise<CrawlError | null>;
};

/**
 * Télécharge une ressource publique avec toutes les protections :
 * contrôle de l'URL et de l'IP à chaque redirection, délai global, taille maximale,
 * nombre de redirections limité, aucun cookie ni identifiant envoyé.
 * Les codes HTTP 4xx/5xx sont renvoyés comme erreurs (HTTP_ERROR) avec le vrai code.
 */
export async function safeFetch(rawUrl: string | URL, options: SafeFetchOptions = {}): Promise<Result<FetchedResource>> {
  const policy = options.policy ?? defaultNetworkPolicy;
  const limits = { ...DEFAULT_LIMITS, ...options.limits };

  const initial = checkUrl(rawUrl, policy);
  if (!initial.ok) return initial;

  const started = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, limits.timeoutMs);
  const agent = createGuardedAgent(policy, limits.timeoutMs);
  const chain: RedirectHop[] = [];
  let current = initial.value;

  try {
    for (;;) {
      if (options.beforeRequest) {
        const refused = await options.beforeRequest(current);
        if (refused) return { ok: false, error: refused };
      }

      const res = await request(current, {
        dispatcher: agent,
        method: "GET",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: options.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "accept-language": "fr,en;q=0.8",
        },
      });

      const location = res.headers.location;
      if (REDIRECT_STATUSES.has(res.statusCode) && typeof location === "string") {
        discard(res.body);
        chain.push({ url: redactUrl(current), status: res.statusCode });
        if (chain.length > limits.maxRedirects) {
          return error("TOO_MANY_REDIRECTS", `Plus de ${limits.maxRedirects} redirections.`, current);
        }
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          return error("INVALID_URL", "Redirection vers une adresse mal formée.", current);
        }
        const checked = checkUrl(next, policy);
        if (!checked.ok) return checked;
        current = checked.value;
        continue;
      }

      if (res.statusCode >= 300) {
        discard(res.body);
        return error("HTTP_ERROR", `Le site a répondu avec le code HTTP ${res.statusCode}.`, current, res.statusCode);
      }

      const contentType = typeof res.headers["content-type"] === "string" ? res.headers["content-type"] : null;
      const declared = Number(res.headers["content-length"]);
      if (Number.isFinite(declared) && declared > limits.maxBytes) {
        discard(res.body);
        return error("TOO_LARGE", `Page trop volumineuse (plus de ${limits.maxBytes} octets).`, current);
      }

      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of res.body) {
        total += chunk.length;
        if (total > limits.maxBytes) {
          discard(res.body);
          return error("TOO_LARGE", `Page trop volumineuse (plus de ${limits.maxBytes} octets).`, current);
        }
        chunks.push(chunk);
      }

      const xRobots = res.headers["x-robots-tag"];
      return {
        ok: true,
        value: {
          requestedUrl: redactUrl(initial.value),
          finalUrl: current.toString(),
          status: res.statusCode,
          contentType,
          xRobotsTag: Array.isArray(xRobots) ? xRobots.join(", ") : (xRobots ?? null),
          body: decodeBody(Buffer.concat(chunks), contentType),
          bytes: total,
          redirectChain: chain,
          durationMs: Date.now() - started,
        },
      };
    }
  } catch (err) {
    return mapError(err, current, timedOut);
  } finally {
    clearTimeout(timer);
    agent.destroy().catch(() => {});
  }
}
