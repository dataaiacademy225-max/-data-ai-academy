import { CheckCircle2Icon, CircleDashedIcon, TriangleAlertIcon } from "lucide-react";
import { LANDING } from "@/content/landing";
import { PILLARS } from "@/server/scoring/catalog";
import type { Pillar } from "@/server/scoring/types";

// Valeurs fictives de l'aperçu, signalées « [DÉMO] » à l'écran. Ce n'est le résultat d'aucun audit.
const DEMO_PILLARS: Record<Pillar, number> = { CLARIFIER: 19, INDEXER: 21, TUNNEL: 14, ENCLENCHER: 13 };
const DEMO_TOTAL = Object.values(DEMO_PILLARS).reduce((a, b) => a + b, 0);

const DEMO_FINDINGS = [
  { icon: TriangleAlertIcon, label: "Données structurées incomplètes", tone: "text-[#ffb380]", status: "À corriger" },
  { icon: CheckCircle2Icon, label: "Proposition de valeur claire", tone: "text-emerald-400", status: "Validé" },
  { icon: CircleDashedIcon, label: "Contenu chargé par JavaScript", tone: "text-muted-foreground", status: "Non vérifié" },
];

/** Aperçu stylisé d'un rapport, avec des données fictives clairement signalées. */
export function ProductPreview() {
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute -inset-px rounded-2xl bg-gradient-to-b from-white/20 via-white/5 to-transparent" />
      <div className="relative rounded-2xl border border-white/10 bg-[#070b13]/90 p-5 shadow-[0_40px_120px_-40px_rgb(255_122_41/0.45)] backdrop-blur-xl sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
          </div>
          <span className="rounded-full border border-accent/60 bg-accent/15 px-2.5 py-0.5 text-xs font-semibold">
            {LANDING.preview.badge}
          </span>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-wider text-muted-foreground uppercase">Score CITE · {LANDING.preview.company}</p>
            <p className="mt-1 font-display text-5xl font-semibold tabular-nums">
              {DEMO_TOTAL}
              <span className="text-lg text-muted-foreground"> /100</span>
            </p>
          </div>
          <svg viewBox="0 0 36 36" className="size-16 -rotate-90" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="url(#preview-ring)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(DEMO_TOTAL / 100) * 97.4} 97.4`}
            />
            <defs>
              <linearGradient id="preview-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ff7a29" />
                <stop offset="100%" stopColor="#ffb380" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <dl className="mt-6 space-y-3">
          {(Object.keys(PILLARS) as Pillar[]).map((pillar) => {
            const { label, maxPoints } = PILLARS[pillar];
            const value = DEMO_PILLARS[pillar];
            return (
              <div key={pillar}>
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">
                    {value} <span className="text-muted-foreground">/ {maxPoints}</span>
                  </dd>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#ff7a29] to-[#ffb380]"
                    style={{ width: `${(value / maxPoints) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </dl>

        <ul className="mt-6 space-y-2 border-t border-white/[0.06] pt-4">
          {DEMO_FINDINGS.map(({ icon: Icon, label, tone, status }) => (
            <li key={label} className="flex items-center gap-2.5 text-sm">
              <Icon className={`size-4 shrink-0 ${tone}`} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <span className={`text-xs ${tone}`}>{status}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">{LANDING.preview.sample}</p>
      </div>
    </div>
  );
}
