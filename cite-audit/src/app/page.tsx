import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  EyeOffIcon,
  FileTextIcon,
  FileSearchIcon,
  LinkIcon,
  MessageSquareQuoteIcon,
  ScanEyeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ThumbsUpIcon,
  WaypointsIcon,
} from "lucide-react";
import { BrandName } from "@/components/brand-name";
import { LandingGlow } from "@/components/landing/landing-glow";
import { ProductPreview } from "@/components/landing/product-preview";
import { LegalLinks } from "@/components/legal/legal-document";
import { FadeIn, Stagger, StaggerItem } from "@/components/premium/fade-in";
import { Magnetic } from "@/components/premium/magnetic";
import { SpotlightCard } from "@/components/premium/spotlight-card";
import { buttonVariants } from "@/components/ui/button";
import { LANDING } from "@/content/landing";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { DEFAULT_MAX_PAGES } from "@/server/crawler/discover";
import { CRITERIA, PILLARS } from "@/server/scoring/catalog";
import type { Pillar } from "@/server/scoring/types";

const PILLAR_LETTERS: Record<Pillar, string> = { CLARIFIER: "C", INDEXER: "I", TUNNEL: "T", ENCLENCHER: "E" };
const WHY_ICONS = [MessageSquareQuoteIcon, SparklesIcon, ScanEyeIcon];
const LEVEL_ICONS = [FileSearchIcon, LinkIcon, ThumbsUpIcon];

export default async function Home() {
  const user = await getCurrentUser();
  const cta = user
    ? { href: "/dashboard", label: LANDING.hero.ctaUser }
    : { href: "/demande-acces", label: LANDING.hero.ctaGuest };
  // Hero : « Auditer mon site » mène à la création d'un audit (nouveau projet) ;
  // sans compte, l'accès étant sur invitation, il ouvre la demande d'accès.
  const auditHref = user ? "/projects/new" : "/demande-acces";
  const pillars = Object.keys(PILLARS) as Pillar[];

  const facts = [
    { value: String(CRITERIA.length), label: "critères vérifiables" },
    { value: String(pillars.length), label: "piliers CITE" },
    { value: String(DEFAULT_MAX_PAGES), label: "pages analysées par audit" },
    { value: "3", label: "niveaux IA : mention, citation, recommandation" },
  ];

  return (
    <div className="theme-premium flex min-h-full flex-1 flex-col">
      {/* En-tête */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex shrink-0 flex-col leading-tight">
            <span className="font-display text-lg font-bold tracking-tight">
              <BrandName />
            </span>
            <span className="hidden text-[11px] whitespace-nowrap text-muted-foreground sm:block">{LANDING.hero.tagline}</span>
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-1 text-sm md:flex">
            {[
              ["#methode", "Méthode"],
              ["#echantillon", "Échantillon IA"],
              ["#limites", "Limites"],
              ["/dashboard", "Tableau de bord"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-md px-3 py-2 text-muted-foreground transition-colors duration-200 hover:bg-white/[0.04] hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {!user && (
              <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "whitespace-nowrap")}>
                Se connecter
              </Link>
            )}
            <Link href={cta.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "whitespace-nowrap")}>
              {user ? (
                "Tableau de bord"
              ) : (
                <>
                  <span className="max-[379px]:hidden">Demander un accès</span>
                  <span className="min-[380px]:hidden">Accès</span>
                </>
              )}
            </Link>
          </div>
        </div>
        <p className="mx-auto -mt-2 max-w-6xl px-4 pb-2 text-[11px] text-muted-foreground sm:hidden">{LANDING.hero.tagline}</p>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <LandingGlow />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-20 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:pt-16 lg:pb-24">
            <div className="min-w-0">
              <p className="reveal-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
                <span className="relative flex size-1.5" aria-hidden="true">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
                </span>
                {LANDING.hero.eyebrow}
              </p>
              <h1
                className="reveal-up mt-5 font-display text-4xl leading-[1.08] font-semibold tracking-tight text-balance break-words sm:text-5xl lg:text-[3.4rem]"
                style={{ animationDelay: "80ms" }}
              >
                <span className="bg-gradient-to-b from-white to-white/75 bg-clip-text text-transparent">
                  {LANDING.hero.titleStart}{" "}
                </span>
                <span className="bg-gradient-to-r from-[#ff7a29] via-[#ffa366] to-[#ffd2b0] bg-clip-text text-transparent drop-shadow-[0_0_24px_rgb(255_122_41/0.35)]">
                  {LANDING.hero.titleHighlight}
                </span>{" "}
                <span className="bg-gradient-to-b from-white to-white/75 bg-clip-text text-transparent">
                  {LANDING.hero.titleEnd}
                </span>
              </h1>
              <p className="reveal-up mt-5 max-w-xl text-lg text-pretty text-[#c9d1dd]" style={{ animationDelay: "160ms" }}>
                {LANDING.hero.lead}
              </p>
              <p
                className="reveal-up mt-4 flex max-w-xl gap-2 text-sm text-pretty text-muted-foreground"
                style={{ animationDelay: "200ms" }}
              >
                <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                <span>{LANDING.hero.transparency}</span>
              </p>
              <div className="reveal-up mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center" style={{ animationDelay: "240ms" }}>
                <Magnetic className="inline-block w-full sm:w-auto">
                  <Link
                    href={auditHref}
                    className={cn(
                      buttonVariants({ variant: "accent", size: "lg" }),
                      "cta-shine h-12 w-full rounded-full px-7 text-base font-semibold sm:w-auto",
                    )}
                  >
                    {LANDING.hero.ctaPrimary}
                    <ArrowRightIcon className="size-4" aria-hidden="true" />
                  </Link>
                </Magnetic>
                <a
                  href="#exemple-rapport"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-12 w-full rounded-full border-white/15 bg-transparent px-6 text-base hover:bg-white/[0.05] sm:w-auto",
                  )}
                >
                  <FileTextIcon className="size-4" aria-hidden="true" />
                  {LANDING.hero.ctaSecondary}
                </a>
              </div>
              {!user && (
                <p className="reveal-up mt-4 text-xs text-muted-foreground" style={{ animationDelay: "320ms" }}>
                  {LANDING.hero.access}
                </p>
              )}
            </div>
            <div className="reveal-up min-w-0" style={{ animationDelay: "300ms" }}>
              <ProductPreview />
            </div>
          </div>
        </section>

        {/* Chiffres */}
        <section className="border-y border-white/[0.06] bg-white/[0.015]">
          <Stagger className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 lg:grid-cols-4">
            {facts.map((fact) => (
              <StaggerItem key={fact.label} className="px-2 py-8 text-center">
                <p className="font-display text-3xl font-semibold tabular-nums sm:text-4xl">{fact.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{fact.label}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* Pourquoi */}
        <Section title={LANDING.why.title} lead={LANDING.why.lead}>
          <Stagger className="grid gap-4 md:grid-cols-3">
            {LANDING.why.items.map((item, i) => {
              const Icon = WHY_ICONS[i];
              return (
                <StaggerItem key={item.title} className="min-w-0">
                  <SpotlightCard className="p-6">
                    <IconTile>
                      <Icon className="size-5" aria-hidden="true" />
                    </IconTile>
                    <h3 className="mt-5 font-display text-lg font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
                  </SpotlightCard>
                </StaggerItem>
              );
            })}
          </Stagger>
        </Section>

        {/* Méthode */}
        <Section id="methode" title={LANDING.method.title} lead={LANDING.method.lead}>
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar) => {
              const { label, maxPoints, question } = PILLARS[pillar];
              return (
                <StaggerItem key={pillar} className="min-w-0">
                  <SpotlightCard className="p-6">
                    <div className="flex items-center justify-between">
                      <span className="bg-gradient-to-b from-[#ff7a29] to-[#ffb380] bg-clip-text font-display text-5xl font-bold text-transparent transition-transform duration-300 group-hover:scale-110">
                        {PILLAR_LETTERS[pillar]}
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
                        {maxPoints} pts
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold">{label}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{question}</p>
                  </SpotlightCard>
                </StaggerItem>
              );
            })}
          </Stagger>
          <FadeIn>
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <WaypointsIcon className="size-4 text-accent" aria-hidden="true" />
              {LANDING.method.note}
            </p>
          </FadeIn>
        </Section>

        {/* Échantillon IA */}
        <Section id="echantillon" title={LANDING.sample.title} lead={LANDING.sample.lead}>
          <Stagger className="grid gap-4 md:grid-cols-3">
            {LANDING.sample.levels.map((level, i) => {
              const Icon = LEVEL_ICONS[i];
              return (
                <StaggerItem key={level.title} className="min-w-0">
                  <SpotlightCard className="p-6">
                    <div className="flex items-center gap-3">
                      <IconTile>
                        <Icon className="size-5" aria-hidden="true" />
                      </IconTile>
                      <span className="text-xs tracking-wider text-muted-foreground uppercase">Niveau {i + 1}</span>
                    </div>
                    <h3 className="mt-5 font-display text-lg font-semibold">{level.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{level.text}</p>
                  </SpotlightCard>
                </StaggerItem>
              );
            })}
          </Stagger>
          <FadeIn>
            <p className="mt-6 text-sm text-muted-foreground">{LANDING.sample.note}</p>
          </FadeIn>
        </Section>

        {/* Limites */}
        <Section id="limites" title={LANDING.limits.title} lead={LANDING.limits.lead}>
          <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LANDING.limits.items.map((item) => (
              <StaggerItem
                key={item}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm transition-colors duration-300 hover:border-white/15"
              >
                <EyeOffIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>
                  {item} <span className="text-muted-foreground">· non mesuré</span>
                </span>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>

        {/* Appel final */}
        <section className="px-4 pb-24">
          <FadeIn className="relative isolate mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 px-6 py-16 text-center sm:px-12">
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_80%_at_50%_120%,rgb(255_122_41/0.35),transparent)]" />
            <div aria-hidden="true" className="premium-grid absolute inset-0 -z-10 opacity-60" />
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {LANDING.finalCta.title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{LANDING.finalCta.lead}</p>
            <div className="mt-8 flex justify-center">
              <Magnetic>
                <Link
                  href={cta.href}
                  className={cn(buttonVariants({ variant: "accent", size: "lg" }), "cta-shine h-12 rounded-full px-7 text-base")}
                >
                  {cta.label}
                  <ArrowRightIcon className="size-4" aria-hidden="true" />
                </Link>
              </Magnetic>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{LANDING.hero.disclaimer}</p>
          </FadeIn>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-muted-foreground">
        <p className="mx-auto max-w-xl px-4">{LANDING.footer}</p>
        <p className="mt-2">
          <BrandName /> · par Data &amp; AI Academy
        </p>
        <LegalLinks className="mt-2" />
      </footer>
    </div>
  );
}

function Section({ id, title, lead, children }: { id?: string; title: string; lead: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:py-24">
      <FadeIn className="mb-10 max-w-2xl">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
        <p className="mt-3 text-muted-foreground">{lead}</p>
      </FadeIn>
      {children}
    </section>
  );
}

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.02] text-foreground/90 transition-colors duration-300 group-hover:border-accent/40 group-hover:text-accent">
      {children}
    </span>
  );
}
