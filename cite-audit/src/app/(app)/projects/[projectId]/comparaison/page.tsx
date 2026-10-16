import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownRightIcon, ArrowUpRightIcon, InfoIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { AutoRefresh } from "@/components/report/auto-refresh";
import { formatPoints, PriorityBadge, StatusLabel } from "@/components/report/labels";
import { LaunchAuditForm } from "@/components/report/launch-audit-form";
import { Badge } from "@/components/ui/badge";
import { agree, plural } from "@/lib/plural";
import { requireUser } from "@/lib/session";
import { launchComparisonAction } from "@/server/actions/comparisons";
import { COMPARISON_WARNING, type ComparedSite } from "@/server/report/comparison";
import { PILLARS } from "@/server/scoring/catalog";
import type { Pillar } from "@/server/scoring/types";
import { getComparison, MAX_COMPETITORS_PER_COMPARISON } from "@/server/services/comparisons";

export const metadata: Metadata = { title: "Comparaison avec les concurrents" };

const PILLAR_ORDER: Pillar[] = ["CLARIFIER", "INDEXER", "TUNNEL", "ENCLENCHER"];
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

function SiteState({ site }: { site: ComparedSite }) {
  if (site.state === "PENDING")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> En cours
      </span>
    );
  if (site.state === "FAILED")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
        {site.isYou ? "Aucun audit terminé" : "Analyse impossible"}
      </span>
    );
  return null;
}

export default async function ComparisonPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await requireUser();
  const data = await getComparison(user.id, projectId);
  if (!data) notFound();
  const { project, comparison, view, pending } = data;
  const you = view.sites.find((s) => s.isYou);
  const launch = !project.isDemo && data.competitorsWithSite > 0 && !pending;

  return (
    <article className="space-y-8">
      {pending && <AutoRefresh intervalMs={5000} />}
      <Link href={`/projects/${project.id}`} className="text-sm text-muted-foreground hover:underline">
        ← {project.companyName}
      </Link>

      <header className="space-y-3">
        <p className="text-sm font-medium text-accent">Comparaison CITE</p>
        <h1 className="font-display text-3xl font-bold">
          {project.companyName} face à ses concurrents{" "}
          {project.isDemo && <Badge variant="demo">Démo — données fictives</Badge>}
        </h1>
        <p role="note" className="flex max-w-3xl gap-2 rounded-md border border-border bg-card/60 p-3 text-sm text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <span>
            {COMPARISON_WARNING} Les concurrents sont notés avec vos informations de marché (secteur, cible, ville, questions
            clés) ; seules leurs pages publiques sont lues, dans le respect de leur fichier robots.txt.
          </span>
        </p>
      </header>

      {!comparison && (
        <section className="space-y-3 rounded-xl border border-dashed border-border p-6">
          <h2 className="font-display text-xl font-semibold">Aucune comparaison pour l&apos;instant</h2>
          {data.competitorsWithSite > 0 ? (
            <p className="text-sm text-muted-foreground">
              {project.isDemo
                ? "Projet de démonstration : la comparaison ne peut pas être lancée."
                : `Les ${Math.min(data.competitorsWithSite, MAX_COMPETITORS_PER_COMPARISON)} premiers concurrents dont l'adresse est connue seront audités (une à trois minutes chacun). Chaque concurrent compte pour un audit dans votre limite du jour.`}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun concurrent n&apos;a d&apos;adresse de site. Ajoutez-en dans les{" "}
              <Link href={`/projects/${project.id}/settings`} className="underline">
                paramètres du projet
              </Link>
              , une ligne par concurrent : « Nom | https://site.com ».
            </p>
          )}
        </section>
      )}

      {comparison && (
        <section aria-labelledby="scores" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="scores" className="font-display text-xl font-semibold">
              Scores côte à côte
            </h2>
            <p className="text-xs text-muted-foreground">Lancée le {date.format(comparison.createdAt)}</p>
          </div>
          {pending && (
            <p role="status" className="text-sm text-muted-foreground">
              Analyse des concurrents en cours : la page se met à jour toute seule. Vous recevrez aussi un e-mail.
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-border bg-card/80">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">Score CITE sur 100 et score de chaque pilier, pour votre site et vos concurrents</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="p-3 font-medium">
                    Site
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Score / 100
                  </th>
                  {PILLAR_ORDER.map((p) => (
                    <th key={p} scope="col" className="p-3 text-right font-medium">
                      {PILLARS[p].label} / {PILLARS[p].maxPoints}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.sites.map((site) => (
                  <tr key={`${site.isYou}-${site.url}`} className={site.isYou ? "bg-accent/10" : "border-t border-border"}>
                    <th scope="row" className="p-3 text-left font-normal">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">
                        {site.name}
                        {site.isYou && <Badge variant="outline">Vous</Badge>}
                      </span>
                      <span className="block max-w-[16rem] truncate text-xs text-muted-foreground">{site.url}</span>
                      <SiteState site={site} />
                      {site.otherVersion && <span className="block text-xs text-muted-foreground">Autre barème : non comparé critère par critère</span>}
                    </th>
                    <td className="p-3 text-right font-display text-lg font-semibold tabular-nums">
                      {site.state === "DONE" ? (site.scoreTotal ?? <span className="text-sm font-normal text-muted-foreground">Non vérifié</span>) : "—"}
                    </td>
                    {PILLAR_ORDER.map((p) => (
                      <td key={p} className="p-3 text-right tabular-nums">
                        {site.state === "DONE" ? (site.pillars[p] !== null ? formatPoints(site.pillars[p]) : "Non vérifié") : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {you?.state !== "DONE" && (
            <p className="text-sm text-muted-foreground">
              Lancez d&apos;abord l&apos;audit de votre site depuis la{" "}
              <Link href={`/projects/${project.id}`} className="underline">
                page du projet
              </Link>{" "}
              : sans lui, la comparaison critère par critère n&apos;est pas possible.
            </p>
          )}
        </section>
      )}

      {view.comparedCompetitors > 0 && (
        <>
          <section aria-labelledby="ecarts" className="space-y-3">
            <h2 id="ecarts" className="font-display text-xl font-semibold">
              Ce que vos concurrents font et pas vous
            </h2>
            <p className="text-sm text-muted-foreground">
              Critères où au moins un concurrent obtient un meilleur résultat que vous, du plus prioritaire au moins
              prioritaire. Les critères non vérifiés d&apos;un côté ou de l&apos;autre ne sont pas comparés.
            </p>
            {view.gaps.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Sur les critères mesurés des deux côtés, aucun concurrent ne fait mieux que vous.
              </p>
            ) : (
              <ul className="space-y-3">
                {view.gaps.map((gap) => (
                  <li key={gap.code} className="space-y-3 rounded-xl border border-border bg-card/80 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <ArrowDownRightIcon className="size-4 text-[#ec835a]" aria-hidden="true" />
                      <h3 className="font-semibold">{gap.label}</h3>
                      <PriorityBadge priority={gap.priority} />
                      <span className="text-xs text-muted-foreground">{PILLARS[gap.pillar].label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Chez vous :</span>
                      <StatusLabel status={gap.yourStatus} />
                    </div>
                    <ul className="space-y-2">
                      {gap.ahead.map((a) => (
                        <li key={a.name} className="rounded-md border border-border p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{a.name}</span>
                            <StatusLabel status={a.status} />
                          </div>
                          {a.evidence && (
                            <p className="mt-1 break-words text-muted-foreground">
                              {a.evidence.label}
                              {a.evidence.excerpt && <> : « {a.evidence.excerpt} »</>}
                              {a.evidence.url && <span className="block break-all text-xs">{a.evidence.url}</span>}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                    {gap.recommendation && (
                      <p className="text-sm">
                        <span className="font-semibold">Action : </span>
                        {gap.recommendation}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="avantages" className="space-y-3">
            <h2 id="avantages" className="font-display text-xl font-semibold">
              Vos avantages
            </h2>
            {view.advantages.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Aucun critère où vous faites mieux que tous les concurrents analysés.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {view.advantages.map((adv) => (
                  <li key={adv.code} className="flex gap-2 rounded-md border border-border bg-card/80 p-3 text-sm">
                    <ArrowUpRightIcon className="mt-0.5 size-4 shrink-0 text-[#0ca30c]" aria-hidden="true" />
                    <span>
                      <span className="font-semibold">{adv.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        Mieux que {adv.behind.join(", ")} · {PILLARS[adv.pillar].label}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="text-xs text-muted-foreground">
            Comparaison sur {plural(view.comparedCompetitors, "concurrent")}{" "}
            {agree(view.comparedCompetitors, "analysé", "analysés")} avec succès.
          </p>
        </>
      )}

      {launch && (
        <div className="space-y-1">
          <LaunchAuditForm
            action={launchComparisonAction.bind(null, project.id)}
            label={comparison ? "Relancer la comparaison" : "Comparer avec mes concurrents"}
            variant={comparison ? "outline" : "accent"}
          />
          <p className="text-xs text-muted-foreground">
            Jusqu&apos;à {MAX_COMPETITORS_PER_COMPARISON} concurrents, 15 pages publiques chacun. Chaque concurrent compte pour
            un audit dans votre limite du jour.
          </p>
        </div>
      )}
    </article>
  );
}
