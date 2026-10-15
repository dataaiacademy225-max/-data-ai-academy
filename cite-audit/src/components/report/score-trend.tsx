import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { AreaChart } from "@/components/ui/area-chart";
import { agree, plural } from "@/lib/plural";
import type { ScoreTrend, TrendPillar } from "@/server/report/trend";

const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const PILLARS: TrendPillar[] = ["Clarifier", "Indexer", "Tunnel", "Enclencher"];
const formatDelta = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("fr-FR")}`;

/** Libellés d'axe uniques : deux audits le même jour deviennent « 3 oct. », « 3 oct. (2) ». */
function labels(dates: Date[]): string[] {
  const seen = new Map<string, number>();
  return dates.map((date) => {
    const label = shortDate.format(date);
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    return n === 1 ? label : `${label} (${n})`;
  });
}

/** Évolution : toujours une icône et un libellé avec la couleur. */
function Delta({ value, unit = "" }: { value: number | null; unit?: string }) {
  if (value === null) return <span className="text-muted-foreground">non mesuré</span>;
  const [Icon, tone, label] =
    value > 0
      ? [TrendingUpIcon, "text-emerald-400", "en hausse"]
      : value < 0
        ? [TrendingDownIcon, "text-[#ff8a65]", "en baisse"]
        : [MinusIcon, "text-muted-foreground", "stable"];
  return (
    <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${tone}`}>
      <Icon className="size-4" aria-hidden="true" />
      {formatDelta(value)}
      {unit} <span className="sr-only">({label})</span>
    </span>
  );
}

/** Courbe du score CITE d'un projet, audit après audit, et écart avec l'audit précédent. */
export function ScoreTrendCard({ trend }: { trend: ScoreTrend }) {
  const axis = labels(trend.points.map((p) => p.date));
  const data = trend.points.map((p, i) => ({ Audit: axis[i], "Score CITE": p.total }));

  return (
    <section className="space-y-3" aria-labelledby="evolution">
      <div>
        <h2 id="evolution" className="font-display text-xl font-semibold">
          Évolution du score CITE
        </h2>
        <p className="text-sm text-muted-foreground">
          Indicateur interne, audit après audit : utile pour voir l&apos;effet de vos corrections sur les signaux de votre site.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card/80 p-5">
        {trend.points.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            {trend.points.length === 0
              ? "Aucun audit noté pour l'instant."
              : "Un seul audit noté : relancez un audit après vos corrections pour voir l'évolution."}
          </p>
        ) : (
          <div className="space-y-5">
            {trend.delta && (
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Depuis l&apos;audit précédent : </span>
                  <Delta value={trend.delta.total} unit=" pts" />
                </p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {PILLARS.map((pillar) => (
                    <li key={pillar}>
                      <span className="text-muted-foreground">{pillar} </span>
                      <Delta value={trend.delta?.pillars[pillar] ?? null} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <AreaChart
              data={data}
              index="Audit"
              categories={["Score CITE"]}
              colors={["chart-1"]}
              yDomain={[0, 100]}
              showLegend={false}
              label="Score CITE sur 100 de chaque audit noté de ce projet"
            />
          </div>
        )}
        {trend.olderVersionCount > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {plural(trend.olderVersionCount, "audit plus ancien, noté", "audits plus anciens, notés")} avec un barème
            précédent, {agree(trend.olderVersionCount, "n'est pas comparé", "ne sont pas comparés")} ici.
          </p>
        )}
      </div>
    </section>
  );
}
