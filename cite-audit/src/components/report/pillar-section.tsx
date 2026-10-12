import type { PillarResult } from "@/server/scoring/types";
import { EvidenceList } from "@/components/report/recommendation-card";
import { formatPoints, PriorityBadge, StatusLabel } from "@/components/report/labels";

/** Détail d'un pilier : chaque critère, ses points et leur justification. */
export function PillarSection({ pillar }: { pillar: PillarResult }) {
  return (
    <section id={`pilier-${pillar.pillar.toLowerCase()}`} className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-semibold">{pillar.label}</h3>
        <p className="text-sm">
          {pillar.score !== null ? (
            <>
              <strong>{formatPoints(pillar.score)}</strong> / {pillar.maxPoints} points
              {pillar.indicative && " (indicatif)"}
            </>
          ) : (
            "Non vérifié"
          )}
          <span className="text-muted-foreground"> · {Math.round(pillar.coverage * 100)} % mesuré</span>
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{pillar.question}</p>
      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {pillar.criteria.map((c) => (
          <li key={c.code} className="break-inside-avoid p-3">
            <details>
              <summary className="flex cursor-pointer list-none flex-wrap items-start gap-x-3 gap-y-1">
                <StatusLabel status={c.status} />
                <span className="flex-1 font-medium">{c.label}</span>
                <span className="text-sm">
                  {c.points !== null ? (
                    <>
                      {formatPoints(c.points)} <span className="text-muted-foreground">/ {c.maxPoints} pts</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">– / {c.maxPoints} pts</span>
                  )}
                </span>
                <span className="basis-full pl-[7.75rem] text-sm text-muted-foreground max-sm:pl-0">{c.explanation}</span>
              </summary>
              <div className="mt-3 space-y-2 pl-[7.75rem] text-sm max-sm:pl-0">
                <p>
                  <span className="font-medium">Critère vérifié : </span>
                  {c.question}
                </p>
                {c.priority && (
                  <p className="flex items-center gap-2">
                    <span className="font-medium">Priorité :</span> <PriorityBadge priority={c.priority} />
                  </p>
                )}
                {c.missing.length > 0 && (
                  <div>
                    <p className="font-medium">Éléments manquants</p>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {c.missing.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.evidence.length > 0 && (
                  <div>
                    <p className="font-medium">Preuves observées</p>
                    <EvidenceList evidence={c.evidence} />
                  </div>
                )}
                {c.confidence && c.confidence !== "HIGH" && (
                  <p className="text-xs text-muted-foreground">
                    Repérage automatique ({c.confidence === "MEDIUM" ? "fiabilité moyenne" : "fiabilité faible"}) : à confirmer par une lecture humaine.
                  </p>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
