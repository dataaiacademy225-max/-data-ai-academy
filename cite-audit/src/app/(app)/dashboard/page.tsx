import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, FolderKanbanIcon, GaugeIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { AI_WARNING } from "@/components/ai-visibility/warning";
import { AiSampleCards } from "@/components/premium/ai-sample-cards";
import { FadeIn, Stagger, StaggerItem } from "@/components/premium/fade-in";
import { HeroBackground } from "@/components/premium/hero-background";
import { SpotlightCard } from "@/components/premium/spotlight-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/session";
import { COUNTRIES } from "@/lib/validation/countries";
import { getAiSampleSummary } from "@/server/services/ai-visibility";
import { listProjects } from "@/server/services/projects";

export const metadata: Metadata = { title: "Tableau de bord" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;

export default async function DashboardPage() {
  const user = await requireUser();
  const [projects, aiSummary] = await Promise.all([listProjects(user.id), getAiSampleSummary(user.id)]);
  const hasDemo = projects.some((p) => p.isDemo);

  // Statistiques : jamais de mélange entre projets réels et démonstration.
  const realProjects = projects.filter((p) => !p.isDemo);
  const statProjects = realProjects.length > 0 ? realProjects : projects;
  const statsAreDemo = realProjects.length === 0 && projects.length > 0;
  const scored = statProjects
    .map((p) => ({ project: p, audit: p.audits[0] }))
    .filter((x) => x.audit?.scoreTotal !== null && x.audit?.scoreTotal !== undefined);
  const latest = scored
    .slice()
    .sort((a, b) => (b.audit?.finishedAt?.getTime() ?? 0) - (a.audit?.finishedAt?.getTime() ?? 0))[0];

  return (
    <div className="space-y-12">
      {/* En-tête immersif */}
      <section className="relative -mx-4 overflow-hidden rounded-2xl border border-border px-6 py-12 sm:mx-0 sm:px-10 sm:py-16">
        <HeroBackground />
        <FadeIn className="relative max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
            <SparklesIcon className="size-3.5 text-accent" aria-hidden="true" />
            Méthode CITE · Clarifier, Indexer, Tunnel, Enclencher
          </p>
          <h1 className="mt-5 bg-gradient-to-b from-white to-white/60 bg-clip-text font-display text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
            Vos sites, leurs signaux.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Repérez ce qui aide Google et les assistants IA à comprendre votre marque, et ce qu&apos;il faut
            corriger en premier. Résultat non garanti : une méthode transparente.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/projects/new" className={buttonVariants({ variant: "accent", size: "lg" })}>
              <PlusIcon className="size-4" aria-hidden="true" />
              Nouveau projet
            </Link>
            {projects[0] && (
              <Link href={`/projects/${projects[0].id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                Ouvrir le dernier projet
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </FadeIn>
      </section>

      {hasDemo && (
        <p className="rounded-xl border border-accent/40 bg-accent/[0.07] p-4 text-sm">
          Les projets marqués <strong>Démo</strong> contiennent des données fictives de démonstration. Ils ne
          décrivent aucune entreprise réelle et ne sont pas des résultats d&apos;audit.
        </p>
      )}

      {/* Chiffres clés */}
      <Stagger className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<FolderKanbanIcon className="size-4" aria-hidden="true" />}
          label="Projets suivis"
          value={String(statProjects.length)}
          demo={statsAreDemo}
        />
        <StatCard
          icon={<GaugeIcon className="size-4" aria-hidden="true" />}
          label="Audits notés"
          value={String(scored.length)}
          demo={statsAreDemo}
        />
        <StatCard
          icon={<SparklesIcon className="size-4" aria-hidden="true" />}
          label="Dernier score CITE"
          value={latest?.audit ? `${latest.audit.scoreTotal}` : "—"}
          suffix={latest?.audit ? "/100" : undefined}
          detail={latest ? latest.project.companyName : "Aucun audit noté"}
          demo={statsAreDemo}
        />
      </Stagger>

      {/* Projets */}
      <section className="space-y-5">
        <SectionTitle title="Vos projets" description="Le dernier audit de chaque site." />
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
                  <Link href={`/projects/${project.id}`} className="block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
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
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">Score CITE</p>
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
                          className="h-full rounded-full bg-gradient-to-r from-[#ff7a29] to-[#ffb380]"
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

      {/* Échantillon de réponses d'IA */}
      <section className="space-y-5">
        <SectionTitle
          title="Échantillon de réponses d'IA"
          description="Ce que des assistants ont répondu à vos questions clés : mentions, citations et recommandations comptées séparément. Ce n'est pas un score."
        />
        {aiSummary.scope === "demo" && (
          <p className="text-sm text-muted-foreground">
            <Badge variant="demo">Démo</Badge> Données fictives des projets de démonstration.
          </p>
        )}
        <AiSampleCards summary={aiSummary} />
        <p role="note" className="text-xs text-muted-foreground">
          <strong className="text-foreground">Avertissement : </strong>
          {AI_WARNING} Les réponses obtenues par API peuvent différer des applications grand public.
        </p>
      </section>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <FadeIn>
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
    </FadeIn>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  detail,
  demo,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  suffix?: string;
  detail?: string;
  demo: boolean;
}) {
  return (
    <StaggerItem>
      <SpotlightCard className="p-5">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-2 text-sm">
            {icon}
            {label}
          </span>
          {demo && <Badge variant="demo">Démo</Badge>}
        </div>
        <p className="mt-4 font-display text-3xl font-semibold tabular-nums">
          {value}
          {suffix && <span className="text-base text-muted-foreground"> {suffix}</span>}
        </p>
        {detail && <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>}
      </SpotlightCard>
    </StaggerItem>
  );
}
