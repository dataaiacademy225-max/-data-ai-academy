import { ArrowUpIcon, BadgeCheckIcon, CalendarIcon, InfoIcon } from "lucide-react";
import { FadeIn } from "@/components/premium/fade-in";
import { buttonVariants } from "@/components/ui/button";
import { LANDING } from "@/content/landing";
import { cn } from "@/lib/utils";

const formatPoints = (n: number) => n.toLocaleString("fr-FR");

/**
 * Preuve sociale honnête : audit INTERNE réel du site de Data & AI Academy, daté, avec ses limites.
 * Aucune capture, source ou témoignage ajouté : uniquement les valeurs du rapport.
 */
export function ProofSection() {
  const { proof } = LANDING;
  const ring = (proof.score / 100) * 97.4;

  return (
    <section id="preuve" aria-labelledby="preuve-titre" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:py-24">
      <FadeIn>
        <div className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-[#070b13]/80 p-6 sm:p-10">
          <div
            aria-hidden="true"
            className="absolute -top-24 -left-24 -z-10 size-80 rounded-full bg-[#ff7a29]/15 blur-[100px]"
          />
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center">
            {/* Score et piliers, tels qu'indiqués dans le rapport */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/60 bg-accent/15 px-2.5 py-1 font-semibold">
                  <BadgeCheckIcon className="size-3.5 text-accent" aria-hidden="true" />
                  {proof.badge}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-muted-foreground">
                  <CalendarIcon className="size-3.5" aria-hidden="true" />
                  Audit du {proof.auditDate}
                </span>
              </div>

              <div className="mt-6 flex items-center gap-5">
                <svg viewBox="0 0 36 36" className="size-20 shrink-0 -rotate-90 sm:size-28" aria-hidden="true">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="url(#proof-ring)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${ring} 97.4`}
                  />
                  <defs>
                    <linearGradient id="proof-ring" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#ff7a29" />
                      <stop offset="100%" stopColor="#ffb380" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="min-w-0">
                  <p className="font-display text-5xl font-semibold tabular-nums sm:text-6xl">
                    {proof.score}
                    <span className="text-xl text-muted-foreground">/100</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Score CITE de <span className="whitespace-nowrap">{proof.site}</span>
                    <span className="block">{proof.pagesAnalyzed} pages analysées</span>
                  </p>
                </div>
              </div>

              <dl className="mt-6 grid gap-x-6 gap-y-3 min-[420px]:grid-cols-2">
                {proof.pillars.map((pillar) => (
                  <div key={pillar.label} className="min-w-0">
                    <div className="flex justify-between gap-2 text-sm">
                      <dt className="text-muted-foreground">{pillar.label}</dt>
                      <dd className="tabular-nums">
                        {formatPoints(pillar.value)} <span className="text-muted-foreground">/ {pillar.max}</span>
                      </dd>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ff7a29] to-[#ffb380]"
                        style={{ width: `${(pillar.value / pillar.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">Barème {proof.scoringVersion}.</p>
            </div>

            {/* Texte */}
            <div className="min-w-0">
              <h2 id="preuve-titre" className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {proof.title}
              </h2>
              <p className="mt-4 text-lg text-[#e9edf3]">{proof.summary}</p>
              <p className="mt-2 text-sm text-muted-foreground">{proof.scoreNote}</p>

              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[#c9d1dd]">{proof.aiObservation}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {proof.aiObservationNote}
                  {proof.aiTestPeriod && <> Tests réalisés {proof.aiTestPeriod}.</>}
                </p>
              </div>

              <p role="note" className="mt-4 flex gap-2 text-sm text-muted-foreground">
                <InfoIcon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                <span>{proof.transparency}</span>
              </p>

              <div className="mt-7">
                <a
                  href="#exemple-rapport"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-auto min-h-12 w-full rounded-full border-white/15 bg-transparent px-6 py-3 text-sm hover:bg-white/[0.05] sm:w-auto sm:text-base",
                  )}
                >
                  {proof.cta}
                  <ArrowUpIcon className="size-4" aria-hidden="true" />
                </a>
                <p className="mt-2 text-xs text-muted-foreground">{proof.ctaNote}</p>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
