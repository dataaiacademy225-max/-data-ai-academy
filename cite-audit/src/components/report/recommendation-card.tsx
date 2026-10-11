import type { Evidence, Recommendation } from "@/server/scoring/types";
import { EFFORT_LABEL, formatPoints, PriorityBadge } from "@/components/report/labels";

export function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {evidence.map((e, i) => (
        <li key={i} className="break-words">
          <span className="font-medium text-foreground">{e.label}</span>
          {e.excerpt && <> : « {e.excerpt} »</>}
          {e.url && <span className="block truncate">{e.url}</span>}
        </li>
      ))}
    </ul>
  );
}

export function RecommendationCard({ rec, index }: { rec: Recommendation; index?: number }) {
  return (
    <article className="break-inside-avoid rounded-md border border-border bg-card p-4">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        {index !== undefined && <span className="text-sm font-semibold text-muted-foreground">{index}.</span>}
        <h4 className="font-semibold">{rec.title}</h4>
        <PriorityBadge priority={rec.priority} />
        <span className="text-xs text-muted-foreground">
          {EFFORT_LABEL[rec.effort]} · jusqu&apos;à {formatPoints(rec.pointsAtStake)} pt{rec.pointsAtStake > 1 ? "s" : ""}
        </span>
      </header>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="font-medium">Constat</dt>
          <dd className="text-muted-foreground">{rec.observation}</dd>
        </div>
        <div>
          <dt className="font-medium">Pourquoi c&apos;est important</dt>
          <dd className="text-muted-foreground">{rec.impact}</dd>
        </div>
        <div>
          <dt className="font-medium">Ce que nous recommandons</dt>
          <dd>{rec.recommendation}</dd>
        </div>
      </dl>
      {rec.evidence.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium">Voir la preuve observée</summary>
          <div className="mt-2">
            <EvidenceList evidence={rec.evidence} />
          </div>
        </details>
      )}
    </article>
  );
}
