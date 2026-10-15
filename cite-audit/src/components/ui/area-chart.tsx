"use client";

import { useId } from "react";
import {
  Area,
  CartesianGrid,
  Legend,
  AreaChart as RechartsAreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { cn } from "@/lib/utils";

/**
 * Graphique de zone au format Tremor Raw (composant copié dans le projet, construit sur Recharts).
 * @tremor/react n'est pas utilisé : il exige React 18 et une configuration Tailwind 3.
 * Couleurs : jetons --chart-1… de globals.css (charte Data & AI Academy, modes clair et sombre).
 */

export type ChartColor = "chart-1" | "chart-2" | "chart-3";

/** Une valeur null laisse un trou dans la courbe (donnée non mesurée). */
type Row = Record<string, string | number | null>;

type AreaChartProps = {
  data: Row[];
  /** Clé de l'axe horizontal (ex. le mois). */
  index: string;
  /** Clés des séries affichées. */
  categories: string[];
  colors?: ChartColor[];
  /** Utilisable seulement depuis un composant client ; depuis le serveur, passer `unit`. */
  valueFormatter?: (value: number) => string;
  /** Unité ajoutée après chaque valeur (ex. " %"). */
  unit?: string;
  /** Description du graphique pour les lecteurs d'écran. */
  label: string;
  showLegend?: boolean;
  yDomain?: [number, number];
  className?: string;
};

const DEFAULT_COLORS: ChartColor[] = ["chart-1", "chart-2", "chart-3"];
const colorVar = (color: ChartColor) => `var(--${color})`;

export function AreaChart({
  data,
  index,
  categories,
  colors = DEFAULT_COLORS,
  valueFormatter: customFormatter,
  unit = "",
  label,
  showLegend = true,
  yDomain,
  className,
}: AreaChartProps) {
  const id = useId().replace(/:/g, "");
  const valueFormatter = customFormatter ?? ((value: number) => `${value}${unit}`);
  const colorOf = (i: number) => colors[i % colors.length];

  return (
    <figure className={cn("w-full", className)}>
      <div className="h-72 w-full" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsAreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {categories.map((category, i) => (
                <linearGradient key={category} id={`${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colorVar(colorOf(i))} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={colorVar(colorOf(i))} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey={index}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickMargin={8}
            />
            <YAxis
              width={unit ? 56 : 44}
              tickLine={false}
              axisLine={false}
              domain={yDomain ?? ["auto", "auto"]}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickFormatter={(value: number) => valueFormatter(value)}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              content={(props: TooltipContentProps) => (
                <ChartTooltip {...props} valueFormatter={valueFormatter} />
              )}
            />
            {showLegend && (
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              />
            )}
            {categories.map((category, i) => (
              <Area
                key={category}
                type="monotone"
                dataKey={category}
                stroke={colorVar(colorOf(i))}
                strokeWidth={2}
                fill={`url(#${id}-${i})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
                isAnimationActive={false}
              />
            ))}
          </RechartsAreaChart>
        </ResponsiveContainer>
      </div>
      {/* Mêmes données en tableau, pour les lecteurs d'écran (enveloppe : un tableau sr-only déborderait sur mobile). */}
      <div className="sr-only">
        <table>
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">{index}</th>
            {categories.map((category) => (
              <th key={category} scope="col">
                {category}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={String(row[index])}>
              <th scope="row">{row[index]}</th>
              {categories.map((category) => (
                <td key={category}>
                  {typeof row[category] === "number" ? valueFormatter(row[category]) : (row[category] ?? "non mesuré")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </figure>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: TooltipContentProps & { valueFormatter: (value: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card/95 px-3 py-2 text-sm text-card-foreground shadow-lg backdrop-blur">
      <p className="mb-1 font-medium">{label}</p>
      <ul className="space-y-0.5">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums">
              {typeof entry.value === "number" ? valueFormatter(entry.value) : "non mesuré"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
