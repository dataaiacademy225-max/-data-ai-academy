import type { AiQueryResult, AiVisibilityRun } from "@/generated/prisma/client";
import { formatUsd } from "@/lib/ai-pricing";
import { cn } from "@/lib/utils";

type Run = AiVisibilityRun & { results: AiQueryResult[] };
type Source = { url: string; title?: string; origin: "API" | "TEXT" };
type Competitor = { name: string; mentioned: boolean; cited: boolean; recommended: boolean };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const RUN_STATUS: Record<string, string> = {
  QUEUED: "En file d'attente",
  RUNNING: "En cours",
  SUCCEEDED: "Terminé",
  PARTIAL: "Terminé avec des erreurs",
  FAILED: "Échec",
  CANCELED: "Annulée (non démarrée à temps)",
};

/** Oui / Non / – (non mesuré), avec icône et libellé : la couleur n'est jamais seule porteuse de sens. */
function Flag({ label, value }: { label: string; value: boolean | null }) {
  const text = value === null ? "–" : value ? "Oui" : "Non";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", value ? "border-[#0ca30c] font-semibold" : "border-border text-muted-foreground")}>
      <span aria-hidden="true">{value ? "✓" : value === false ? "✗" : "·"}</span>
      {label} : {text}
    </span>
  );
}

function ResultItem({ result, canceled }: { result: AiQueryResult; canceled: boolean }) {
  const sources = (result.sources as Source[] | null) ?? [];
  const competitors = ((result.competitorsMentioned as Competitor[] | null) ?? []).filter((c) => c.mentioned || c.cited);
  return (
    <li className="space-y-2 p-4">
      <p className="font-medium">« {result.query} »</p>
      {result.status === "PENDING" && (
        <p className="text-sm text-muted-foreground">
          {canceled ? "Non envoyée : la mesure a été annulée car elle n'a pas démarré à temps (aucun coût)." : "En attente d'envoi…"}
        </p>
      )}
      {result.status === "FAILED" && (
        <p className="text-sm text-destructive">
          Échec ({result.errorCode}
          {result.httpStatus ? `, HTTP ${result.httpStatus}` : ""}) : {result.errorMessage}
        </p>
      )}
      {result.status === "SUCCEEDED" && (
        <>
          <div className="flex flex-wrap gap-2">
            <Flag label="Mentionnée" value={result.brandMentioned} />
            <Flag label="Citée en source" value={result.brandCited} />
            <Flag label="Recommandée" value={result.brandRecommended} />
            {result.approxPosition !== null && <span className="text-xs text-muted-foreground">Position approximative : {result.approxPosition}</span>}
          </div>
          {result.brandExcerpt && <p className="text-sm text-muted-foreground">Extrait : « {result.brandExcerpt} »</p>}
          {competitors.length > 0 && (
            <p className="text-sm">
              <span className="font-medium">Concurrents détectés : </span>
              {competitors.map((c) => `${c.name}${c.recommended ? " (recommandé)" : c.cited ? " (cité)" : ""}`).join(", ")}
            </p>
          )}
          {sources.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-medium">Sources renvoyées ({sources.length})</summary>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {sources.map((s) => (
                  <li key={s.url} className="break-all">
                    {s.title ? `${s.title} — ` : ""}
                    {s.url} <span className="italic">({s.origin === "API" ? "fournie par l'API" : "écrite dans la réponse"})</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <details>
            <summary className="cursor-pointer text-sm font-medium">Réponse brute (non modifiée)</summary>
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-xs">{result.rawResponse}</pre>
          </details>
          <p className="text-xs text-muted-foreground">
            {result.askedAt && dateTime.format(result.askedAt)} · modèle {result.model}
            {result.latencyMs !== null && ` · ${(result.latencyMs / 1000).toFixed(1)} s`}
            {result.costUsd !== null && ` · ${formatUsd(result.costUsd)}`}
            {result.confidence !== null && result.confidence < 0.8 && " · lecture automatique peu fiable (nom court ou courant), à vérifier"}
          </p>
        </>
      )}
    </li>
  );
}

export function RunResults({ run }: { run: Run }) {
  const answered = run.results.filter((r) => r.status === "SUCCEEDED");
  const count = (key: "brandMentioned" | "brandCited" | "brandRecommended") => answered.filter((r) => r[key]).length;
  const progress = run.progress as { done?: number; total?: number; waitingMs?: number } | null;
  const active = run.status === "QUEUED" || run.status === "RUNNING";

  return (
    <article className="rounded-md border border-border bg-card">
      <header className="space-y-1 border-b border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">
            {dateTime.format(run.queuedAt)} · {run.model}
          </h3>
          <span className="text-sm">{RUN_STATUS[run.status]}</span>
        </div>
        {active && progress?.total ? (
          <p className="text-sm text-muted-foreground">
            {progress.done ?? 0} / {progress.total} requête(s) traitée(s)
            {progress.waitingMs ? ` · limite du fournisseur atteinte, nouvel essai dans ${Math.ceil(progress.waitingMs / 1000)} s` : ""}
          </p>
        ) : null}
        {answered.length > 0 && (
          <p className="text-sm">
            Sur cet échantillon de <strong>{answered.length}</strong> réponse(s) : marque mentionnée dans <strong>{count("brandMentioned")}</strong>,
            citée en source dans <strong>{count("brandCited")}</strong>, recommandée explicitement dans <strong>{count("brandRecommended")}</strong>.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Coût estimé : {formatUsd(run.estimatedCostMinUsd)} à {formatUsd(run.estimatedCostMaxUsd)}
          {run.actualCostUsd !== null && ` · coût communiqué par l'API : ${formatUsd(run.actualCostUsd)}`}
          {run.isDemo && " · données fictives de démonstration"}
        </p>
      </header>
      <ul className="divide-y divide-border">
        {run.results.map((r) => (
          <ResultItem key={r.id} result={r} canceled={run.status === "CANCELED"} />
        ))}
      </ul>
    </article>
  );
}
