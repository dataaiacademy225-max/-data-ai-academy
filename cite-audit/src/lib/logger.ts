/**
 * Journal structuré (une ligne JSON par événement), avec masquage systématique.
 * Ne jamais y passer de corps de réponse, de clé API ni de mot de passe : le masquage est un filet, pas une excuse.
 */

type Level = "info" | "warn" | "error";
type LogContext = Record<string, unknown>;
type Sink = (level: Level, line: string) => void;

const SENSITIVE_KEY = /pass(word)?|secret|token|api[-_]?key|authorization|cookie|session|credential|email/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;
const LONG_SECRET = /\b(sk|pk|key|tok)[-_][A-Za-z0-9_-]{12,}\b/gi;
const URL_IN_TEXT = /\bhttps?:\/\/[^\s"'<>]+/gi;

/** Retire identifiants, paramètres et ancre d'une URL trouvée dans un texte. */
function stripUrl(match: string): string {
  try {
    const u = new URL(match);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return "[url]";
  }
}

export function sanitizeText(value: string): string {
  return value
    .replace(URL_IN_TEXT, stripUrl)
    .replace(EMAIL, "[email]")
    .replace(BEARER, "$1 [masqué]")
    .replace(LONG_SECRET, "[secret]")
    .slice(0, 500);
}

export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[…]";
  if (typeof value === "string") return sanitizeText(value);
  if (value instanceof Error) return { name: value.name, code: (value as { code?: unknown }).code };
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[masqué]" : sanitize(v, depth + 1);
    }
    return out;
  }
  return value;
}

let sink: Sink = (level, line) => {
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
};

/** Pour les tests : capter les lignes de journal. Renvoie une fonction de restauration. */
export function setLogSink(next: Sink): () => void {
  const previous = sink;
  sink = next;
  return () => {
    sink = previous;
  };
}

function write(level: Level, event: string, context: LogContext = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...(sanitize(context) as LogContext) });
  sink(level, line);
}

export const logger = {
  info: (event: string, context?: LogContext) => write("info", event, context),
  warn: (event: string, context?: LogContext) => write("warn", event, context),
  error: (event: string, context?: LogContext) => write("error", event, context),
};
