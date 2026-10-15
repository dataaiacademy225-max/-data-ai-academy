import type { ReactNode } from "react";
import { AnimatedNumber } from "@/components/premium/animated-number";
import { StaggerItem } from "@/components/premium/fade-in";
import { Sparkline } from "@/components/premium/sparkline";
import { SpotlightCard } from "@/components/premium/spotlight-card";
import { Badge } from "@/components/ui/badge";

type MetricCardProps = {
  icon: ReactNode;
  label: string;
  /** null : la métrique n'est pas mesurée ; la raison est donnée par `detail`. */
  value: number | null;
  decimals?: number;
  suffix?: string;
  detail: string;
  /** Explication complète, en info-bulle et pour les lecteurs d'écran. */
  hint: string;
  trend?: number[];
  trendDomain?: [number, number];
  demo?: boolean;
};

/** Carte de métrique clé : chiffre animé, mini-courbe et explication. */
export function MetricCard({ icon, label, value, decimals, suffix, detail, hint, trend, trendDomain, demo }: MetricCardProps) {
  return (
    <StaggerItem className="min-w-0">
      <SpotlightCard className="flex flex-col p-5">
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <span className="flex min-w-0 items-center gap-2 text-sm" title={hint}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-foreground/80 transition-colors duration-300 group-hover:border-accent/40 group-hover:text-accent">
              {icon}
            </span>
            <span className="truncate">{label}</span>
          </span>
          {demo && <Badge variant="demo">Démo</Badge>}
        </div>
        <p className="mt-4 font-display text-3xl font-semibold tabular-nums tracking-tight">
          {value === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <>
              <AnimatedNumber value={value} decimals={decimals} />
              {suffix && <span className="text-base font-normal text-muted-foreground">{suffix}</span>}
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        <span className="sr-only">{hint}</span>
        <div className="mt-auto pt-3">{trend && <Sparkline values={trend} domain={trendDomain} />}</div>
      </SpotlightCard>
    </StaggerItem>
  );
}
