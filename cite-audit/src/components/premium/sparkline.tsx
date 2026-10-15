"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

/** Mini-courbe décorative d'une carte de métrique. Les valeurs détaillées sont dans les graphiques. */
export function Sparkline({ values, domain }: { values: number[]; domain?: [number, number] }) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const data = values.map((value, i) => ({ i, value }));
  return (
    <div className="h-10 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={domain ?? ["dataMin", "dataMax"]} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={1.5}
            fill={`url(#${id})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
