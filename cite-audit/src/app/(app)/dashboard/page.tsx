import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, GaugeIcon, LinkIcon, MessageSquareQuoteIcon, PieChartIcon, PlusIcon } from "lucide-react";
import { AI_WARNING } from "@/components/ai-visibility/warning";
import { AiSampleCards } from "@/components/premium/ai-sample-cards";
import { FadeIn, Stagger, StaggerItem } from "@/components/premium/fade-in";
import { HeroBackground } from "@/components/premium/hero-background";
import { MetricCard } from "@/components/premium/metric-card";
import { SpotlightCard } from "@/components/premium/spotlight-card";
import { AreaChart } from "@/components/ui/area-chart";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/session";
import { COUNTRIES } from "@/lib/validation/countries";
import { getAiDashboard } from "@/server/services/ai-visibility";
import { getScoreHistory } from "@/server/services/audits";
import { listProjects } from "@/server/services/projects";

export const metadata: Metadata = { title: "Tableau de bord" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;
const percent = (ratio: number) => Math.round(ratio * 100);
const plural = (n: number, singular: string, pluralForm: string) => `${n} ${n > 1 ? pluralForm : singular}`;

/** Libellés d'axe uniques : deux lancements le même jour deviennent « 3 oct. », « 3 oct. (2) ». */
function uniqueLabels(dates: Date[]): string[] {
  const seen = new Map<string, number>();
  return dates.map((date) => {
    const label = shortDate.format(date);
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    return n === 1 ? label : `${label} (${n})`;
  });
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [projects, ai, scores] = await Promise.all([
    listProjects(user.id),
    getAiDashboard(user.id),
    getScoreHistory(user.id),
  ]);
  const { summary, geo } = ai;
  const hasDemo = projects.some((p) => p.isDemo);
  const geoDemo = geo.scope === "demo";
  const scoresDemo = scores.length > 0 && scores.every((s) => s.isDemo);
  const latestScore = scores.at(-1);

  const geoLabels = uniqueLabels(geo.timeline.map((p) => p.date));
  const geoChart = geo.timeline.map((point, i) => ({
    Lancement: geoLabels[i],
    "Taux de mention": percent(point.mentionRate),
    "Part de voix": point.shareOfVoice === null ? null : percent(point.shareOfVoice),
  }));
  const scoreLabels = uniqueLabels(scores.map((s) => s.finishedAt));
  const scoreChart = scores.map((s, i) => ({ Audit: scoreLabels[i], "Score CITE": s.score }));

  const noSample = "Aucun échantillon analysé";
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-12">
      {/* En-tête */}
      <section className="relative -mx-4 overflow-hidden border-y border-border px-6 py-10 sm:mx-0 sm:rounded-2xl sm:border sm:px-10 sm:py-12">
        <HeroBackground />
        <FadeIn className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-sm text-muted-foreground">Bonjour{firstName ? ` ${firstName}` : ""},</p>
            <h1 className="mt-2 bg-gradient-to-b from-white to-white/60 bg-clip-text font-display text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
              Vos signaux GEO, d&apos;un coup d&apos;œil.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Score CITE de vos sites et échantillon de réponses d&apos;assistants IA. Des repères pour décider
              quoi corriger en premier. Résultat non garanti.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/projects/new" className={buttonVariants({ variant: "accent", size: "lg" })}>
              <PlusIcon className="size-4" aria-hidden="true" />
              Nouveau projet
            </Link>
            {projects[0] && (
              <Link href={`/projects/${projects[0].id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                Dernier projet
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </FadeIn>
      </section>

      {hasDemo && (
        <p className="rounded-xl border border-accent/40 bg-accent/[0.07] p-4 text-sm">
          Les éléments marqués <strong>Démo</strong> contiennent des données fictives de démonstration. Ils ne
          décrivent aucune entreprise réelle et ne sont pas des résultats d&apos;audit.
        </p>
      )}

      {/* Métriques clés */}
      <section className="space-y-5" aria-labelledby="metriques">
        <SectionTitle
          id="metriques"
          title="Métriques clés"
          description="Les trois premières sont comptées sur l'échantillon de réponses d'IA, jamais sur l'ensemble des conversations. Le score CITE porte sur votre site."
        />
        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<PieChartIcon className="size-4" aria-hidden="true" />}
            label="Part de voix"
            value={geo.shareOfVoice === null ? null : percent(geo.shareOfVoice)}
            suffix=" %"
            detail={
              geo.shareOfVoice === null
                ? geo.analyzed
                  ? "Non mesurée : aucun concurrent suivi"
                  : noSample
                : `${plural(geo.brandMentions, "mention", "mentions")} de la marque, ${geo.competitorMentions} de concurrents`
            }
            hint="Mentions de votre marque divisées par l'ensemble des mentions (votre marque et les concurrents suivis), dans l'échantillon."
            trend={geo.timeline.flatMap((p) => (p.shareOfVoice === null ? [] : [percent(p.shareOfVoice)]))}
            trendDomain={[0, 100]}
            demo={geoDemo}
          />
          <MetricCard
            icon={<LinkIcon className="size-4" aria-hidden="true" />}
            label="Citations"
            value={geo.analyzed ? geo.cited : null}
            suffix={geo.analyzed ? ` / ${geo.analyzed}` : undefined}
            detail={geo.analyzed ? "Réponses dont une source pointe vers votre site" : noSample}
            hint="Nombre de réponses de l'échantillon dont au moins une source renvoie vers votre site."
            trend={geo.timeline.map((p) => p.citations)}
            demo={geoDemo}
          />
          <MetricCard
            icon={<MessageSquareQuoteIcon className="size-4" aria-hidden="true" />}
            label="Taux de mention"
            value={geo.mentionRate === null ? null : percent(geo.mentionRate)}
            suffix=" %"
            detail={geo.analyzed ? `Votre nom apparaît dans ${geo.mentioned} ${geo.analyzed > 1 ? "réponses" : "réponse"} sur ${geo.analyzed}` : noSample}
            hint="Réponses de l'échantillon où le nom ou le domaine de votre marque apparaît. Une mention n'est pas une recommandation."
            trend={geo.timeline.map((p) => percent(p.mentionRate))}
            trendDomain={[0, 100]}
            demo={geoDemo}
          />
          <MetricCard
            icon={<GaugeIcon className="size-4" aria-hidden="true" />}
            label="Score CITE"
            value={latestScore ? latestScore.score : null}
            suffix=" /100"
            detail={latestScore ? `${latestScore.companyName} · ${dateFormat.format(latestScore.finishedAt)}` : "Aucun audit noté"}
            hint="Indicateur interne Data & AI Academy, calculé sur les signaux observables du site. Ce n'est pas une mesure de Google ni d'une IA."
            trend={scores.map((s) => s.score)}
            trendDomain={[0, 100]}
            demo={scoresDemo}
          />
        </Stagger>
      </section>

      {/* Graphiques */}
      <section className="grid gap-4 lg:grid-cols-5">
        <FadeIn className="min-w-0 lg:col-span-3">
          <ChartPanel
            title="Évolution de l'échantillon"
            description="Taux de mention et part de voix, par lancement."
            demo={geoDemo}
          >
            {geoChart.length >= 2 ? (
              <AreaChart
                data={geoChart}
                index="Lancement"
                categories={["Taux de mention", "Part de voix"]}
                colors={["chart-1", "chart-2"]}
                unit=" %"
                yDomain={[0, 100]}
                label="Taux de mention et part de voix de la marque, en pourcentage, pour chaque lancement d'échantillon"
              />
            ) : (
              <EmptyChart text="Au moins deux lancements d'échantillon sont nécessaires pour tracer une évolution." />
            )}
          </ChartPanel>
        </FadeIn>
        <FadeIn className="min-w-0 lg:col-span-2" delay={0.08}>
          <ChartPanel title="Score CITE des derniers audits" description="Sur 100, tous projets confondus." demo={scoresDemo}>
            {scoreChart.length >= 2 ? (
              <AreaChart
                data={scoreChart}
                index="Audit"
                categories={["Score CITE"]}
                colors={["chart-1"]}
                yDomain={[0, 100]}
                showLegend={false}
                label="Score CITE sur 100 des derniers audits notés"
              />
            ) : (
              <EmptyChart text="Au moins deux audits notés sont nécessaires pour tracer une évolution." />
            )}
          </ChartPanel>
        </FadeIn>
      </section>

      {/* Échantillon par assistant */}
      <section className="space-y-5" aria-labelledby="assistants">
        <SectionTitle
          id="assistants"
          title="Par assistant"
          description="Mentions, citations et recommandations comptées séparément. Ce n'est pas un score."
        />
        {summary.scope === "demo" && (
          <p className="text-sm text-muted-foreground">
            <Badge variant="demo">Démo</Badge> Données fictives des projets de démonstration.
          </p>
        )}
        <AiSampleCards summary={summary} />
        <p role="note" className="text-xs text-muted-foreground">
          <strong className="text-foreground">Avertissement : </strong>
          {AI_WARNING} Les réponses obtenues par API peuvent différer des applications grand public.
        </p>
      </section>

      {/* Projets */}
      <section className="space-y-5" aria-labelledby="projets">
        <SectionTitle id="projets" title="Vos projets" description="Le dernier audit de chaque site." />
        {projects.length === 0 ? (
          <FadeIn>
            <SpotlightCard className="p-8 text-center">
              <p className="font-display text-lg font-semibold">Aucun projet pour l&apos;instant</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Créez un projet avec l&apos;adresse de votre site, votre secteur et votre cible, puis lancez un
                audit CITE.
              </p>
              <Link href="/projects/new" className={`${buttonVariants({ variant: "accent" })} mt-6`}>
                Créer mon premier projet
              </Link>
            </SpotlightCard>
          </FadeIn>
        ) : (
          <Stagger className="grid gap-4 sm:grid-cols-2">
            {projects.map((project) => {
              const lastAudit = project.audits[0];
              const score = lastAudit?.scoreTotal ?? null;
              return (
                <StaggerItem key={project.id} className="min-w-0">
                  <Link
                    href={`/projects/${project.id}`}
                    className="block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <SpotlightCard className="p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-display text-lg font-semibold">{project.companyName}</p>
                          <p className="truncate text-sm text-muted-foreground">{project.siteUrl}</p>
                        </div>
                        {project.isDemo && <Badge variant="demo">Démo</Badge>}
                      </div>
                      <div className="mt-6 flex items-end justify-between gap-4">
                        <div>
                          <p className="text-xs tracking-wider text-muted-foreground uppercase">Score CITE</p>
                          <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
                            {score !== null ? score : "—"}
                            {score !== null && <span className="text-base text-muted-foreground"> /100</span>}
                          </p>
                        </div>
                        <ArrowRightIcon
                          className="size-5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-foreground"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#ff7a29] to-[#ffb380] transition-[filter] duration-300 group-hover:brightness-125"
                          style={{ width: `${score ?? 0}%` }}
                        />
                      </div>
                      <p className="mt-4 text-xs text-muted-foreground">
                        {project.sector} · {project.city ? `${project.city}, ` : ""}
                        {countryName(project.country)} ·{" "}
                        {lastAudit
                          ? score !== null
                            ? "dernier audit noté"
                            : "dernier audit : score non vérifié"
                          : "aucun audit lancé"}{" "}
                        · créé le {dateFormat.format(project.createdAt)}
                      </p>
                    </SpotlightCard>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <FadeIn>
      <h2 id={id} className="font-display text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
    </FadeIn>
  );
}

function ChartPanel({ title, description, demo, children }: { title: string; description: string; demo: boolean; children: ReactNode }) {
  return (
    <div className="h-full rounded-xl border border-border bg-card/80 p-5 shadow-[0_1px_0_0_rgb(255_255_255/0.04)_inset] transition-colors duration-300 hover:border-white/15">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {demo && <Badge variant="demo">Démo</Badge>}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-border bg-white/[0.015] px-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
