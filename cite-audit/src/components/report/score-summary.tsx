import type { PillarResult, ScoringResult } from "@/server/scoring/types";
import { formatPoints } from "@/components/report/labels";

/** Chiffre principal : score global sur 100, ou « non vérifié ». */
export function ScoreHero({ report }: { report: ScoringResult }) {
  const verified = report.scoreTotal !== null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">Score CITE</p>
      {verified ? (
        <p className="font-sans text-6xl font-semibold leading-none">
          {report.scoreTotal}
          <span className="text-2xl font-normal text-muted-foreground"> / 100</span>
        </p>
      ) : (
        <p className="font-sans text-4xl font-semibold leading-tight">Non vérifié</p>
      )}
      <p className="text-sm text-muted-foreground">
        {verified
          ? report.status === "INDICATIVE"
            ? "Score indicatif : une partie des critères n'a pas pu être mesurée."
            : `${Math.round(report.coverage * 100)} % du barème mesuré sur les pages analysées.`
          : report.notVerifiedReason}
      </p>
    </div>
  );
}

/** Jauge d'un pilier : remplissage orange, piste dans une teinte claire du même orange. */
export function PillarMeter({ pillar }: { pillar: PillarResult }) {
  const scored = pillar.score !== null;
  const ratio = scored ? pillar.score! / pillar.maxPoints : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <a href={`#pilier-${pillar.pillar.toLowerCase()}`} className="font-medium underline-offset-2 hover:underline">
          {pillar.label}
        </a>
        <span className="text-sm">
          {scored ? (
            <>
              <strong>{formatPoints(pillar.score!)}</strong>
              <span className="text-muted-foreground"> / {pillar.maxPoints}</span>
              {pillar.indicative && <span className="ml-1 text-xs text-muted-foreground">(indicatif)</span>}
            </>
          ) : (
            <span className="text-muted-foreground">Non vérifié</span>
          )}
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${pillar.label} : ${scored ? `${formatPoints(pillar.score!)} sur ${pillar.maxPoints}` : "non vérifié"}`}
        aria-valuemin={0}
        aria-valuemax={pillar.maxPoints}
        aria-valuenow={scored ? pillar.score! : undefined}
        className={scored ? "h-2.5 overflow-hidden rounded-full bg-accent/20" : "h-2.5 rounded-full border border-dashed border-border"}
      >
        {scored && <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(ratio * 100, 2)}%` }} />}
      </div>
      <p className="text-xs text-muted-foreground">{pillar.question}</p>
    </div>
  );
}
