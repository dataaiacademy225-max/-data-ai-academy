import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditProgress } from "@/components/report/audit-progress";
import { PillarSection } from "@/components/report/pillar-section";
import { PrintButton } from "@/components/report/print-button";
import { RecommendationCard } from "@/components/report/recommendation-card";
import { PillarMeter, ScoreHero } from "@/components/report/score-summary";
import { EFFORT_LABEL, PriorityBadge } from "@/components/report/labels";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/session";
import type { PageRole, Pillar } from "@/server/scoring/types";
import { buildReportView, metaFor, OWNER_LABEL } from "@/server/report/view";
import { getAuditReport } from "@/server/services/audits";
import { agree, plural } from "@/lib/plural";

export const metadata: Metadata = { title: "Rapport d'audit" };

const PILLAR_ORDER: Pillar[] = ["CLARIFIER", "INDEXER", "TUNNEL", "ENCLENCHER"];
const ROLE_LABEL: Record<PageRole, string> = {
  home: "Accueil",
  offer: "Offre",
  about: "À propos",
  contact: "Contact",
  case_study: "Étude de cas",
  faq: "FAQ",
  blog: "Article",
  other: "Autre page",
};
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

export default async function AuditReportPage({ params }: { params: Promise<{ projectId: string; auditId: string }> }) {
  const { projectId, auditId } = await params;
  const user = await requireUser();
  const data = await getAuditReport(user.id, auditId);
  if (!data || data.project.id !== projectId) notFound();
  const { audit, project, report } = data;
  const nothingMeasured = report?.coverage === 0;
  const skipped = Number((audit.progress as { skipped?: number } | null)?.skipped ?? 0);
  const NOTHING = "Rien n'a pu être mesuré : voir la section « Limites ».";
  const view = report ? buildReportView(report) : null;

  return (
    <article className="space-y-10 print:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/projects/${project.id}`} className="text-sm text-muted-foreground hover:underline">
          ← {project.companyName}
        </Link>
        {report && <PrintButton />}
      </div>

      <header className="space-y-2">
        <p className="text-sm font-medium text-accent">Rapport d&apos;audit CITE</p>
        <h1 className="font-display text-3xl font-bold">
          {project.companyName} {audit.isDemo && <Badge variant="demo">Démo — données fictives</Badge>}
        </h1>
        <p className="break-all text-sm text-muted-foreground">
          {project.siteUrl} · {dateTime.format(audit.finishedAt ?? audit.queuedAt)}
        </p>
      </header>

      {audit.status === "QUEUED" || audit.status === "RUNNING" ? (
        <AuditProgress status={audit.status} progress={audit.progress as { phase?: string; pagesDone?: number; pagesTotal?: number } | null} queuedForMs={data.queuedForMs} />
      ) : !report ? (
        <p className="rounded-md border border-border bg-card p-4">
          {audit.status === "CANCELED"
            ? "Cet audit a été annulé car il n'a pas démarré à temps. Relancez-le depuis la page du projet."
            : "L'audit n'a pas pu aboutir. Relancez-le depuis la page du projet."}
        </p>
      ) : (
        <>
          {/* 1. Synthèse : le diagnostic d'abord, puis les priorités par question */}
          <section aria-labelledby="synthese" className="space-y-6 rounded-md border border-border bg-card p-6">
            <h2 id="synthese" className="font-display text-2xl font-semibold">
              Synthèse
            </h2>

            <div className="space-y-2 rounded-md border-l-4 border-accent bg-muted p-4">
              <h3 className="font-semibold">Notre diagnostic</h3>
              <ul className="space-y-1.5 text-sm">
                {view!.diagnosis.slice(0, -1).map((sentence) => (
                  <li key={sentence} className="flex gap-2">
                    <span aria-hidden="true" className="text-accent">→</span>
                    {sentence}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{view!.diagnosis.at(-1)}</p>
            </div>

            <div className="grid gap-8 md:grid-cols-[minmax(0,14rem)_1fr]">
              <ScoreHero report={report} />
              <div className="grid gap-5 sm:grid-cols-2">
                {PILLAR_ORDER.map((p) => (
                  <PillarMeter key={p} pillar={report.pillars[p]} />
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {view!.groups.map((g) => (
                <div key={g.id} className="space-y-2">
                  <h3 className="font-semibold">{g.title} : vos priorités</h3>
                  <p className="text-xs text-muted-foreground">{g.question}</p>
                  {g.top.length ? (
                    <ol className="space-y-3 text-sm">
                      {g.top.map((r, i) => (
                        <li key={r.criterionCode} className="space-y-0.5">
                          <p className="flex flex-wrap items-center gap-2 font-medium">
                            <span className="text-muted-foreground">{i + 1}.</span> {r.title} <PriorityBadge priority={r.priority} />
                          </p>
                          {/* Action technique : le frein en mots simples ici, la consigne détaillée dans le plan d'action. */}
                          <p>
                            {metaFor(r.criterionCode).owner === "WEB"
                              ? `${capitalize(metaFor(r.criterionCode).issue)}. Fiche à transmettre à votre prestataire web dans le plan d'action.`
                              : r.recommendation}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Qui : {OWNER_LABEL[metaFor(r.criterionCode).owner]} · {EFFORT_LABEL[r.effort]}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">{nothingMeasured ? NOTHING : "Aucune action prioritaire sur les critères mesurés."}</p>
                  )}
                </div>
              ))}
            </div>

            <div>
              <h3 className="mb-2 font-semibold">Vos forces</h3>
              {report.strengths.length ? (
                <ul className="grid gap-2 text-sm sm:grid-cols-3">
                  {report.strengths.slice(0, 3).map((s) => (
                    <li key={s.criterionCode} className="flex gap-2">
                      <span aria-hidden="true" className="text-[#0ca30c]">✓</span>
                      {s.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{nothingMeasured ? NOTHING : "Aucun critère pleinement validé."}</p>
              )}
            </div>

            <div className="space-y-1 rounded-md border border-border p-4 text-sm">
              <h3 className="font-semibold">Ce que ce rapport ne mesure pas</h3>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {view!.notMeasured.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{report.disclaimer}</p>
          </section>

          {/* 2. Plan d'action : par question, puis par responsable */}
          {report.recommendations.length > 0 && (
            <section aria-labelledby="plan" className="space-y-8">
              <div>
                <h2 id="plan" className="font-display text-2xl font-semibold">
                  Plan d&apos;action
                </h2>
                <p className="text-sm text-muted-foreground">
                  Dans chaque partie, les actions sont classées par ordre de priorité : gravité, puis ce qui aide à être trouvé, puis
                  l&apos;effort le plus faible.
                </p>
              </div>
              {view!.groups.map((g) =>
                g.ownActions.length + g.webActions.length === 0 ? null : (
                  <div key={g.id} className="space-y-4">
                    <h3 className="text-xl font-semibold">{g.title}</h3>
                    {g.ownActions.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold">À piloter par vous</h4>
                        <div className="grid gap-3">
                          {g.ownActions.map((r) => (
                            <RecommendationCard key={r.criterionCode} rec={r} />
                          ))}
                        </div>
                      </div>
                    )}
                    {g.webActions.length > 0 && (
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold">À transmettre à votre prestataire web</h4>
                          <p className="text-xs text-muted-foreground">Points techniques : vous pouvez lui transmettre ces fiches telles quelles.</p>
                        </div>
                        <div className="grid gap-3">
                          {g.webActions.map((r) => (
                            <RecommendationCard key={r.criterionCode} rec={r} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ),
              )}
            </section>
          )}

          {/* 3. Détail par pilier */}
          <section aria-labelledby="detail" className="space-y-8">
            <div>
              <h2 id="detail" className="font-display text-2xl font-semibold">
                Détail des critères
              </h2>
              <p className="text-sm text-muted-foreground">Cliquez sur un critère pour voir la preuve observée et les éléments manquants.</p>
            </div>
            {PILLAR_ORDER.map((p) => (
              <PillarSection key={p} pillar={report.pillars[p]} />
            ))}
          </section>

          {/* 4. Limites et éléments non vérifiés */}
          <section aria-labelledby="limites" className="space-y-4 rounded-md border border-border bg-card p-6">
            <h2 id="limites" className="font-display text-2xl font-semibold">
              Limites et éléments non vérifiés
            </h2>
            <div className="space-y-1 text-sm">
              <h3 className="font-semibold">Pages analysées ({report.analyzedPages.filter((p) => p.ok).length} sur {report.analyzedPages.length} tentées)</h3>
              <ul className="space-y-1">
                {report.analyzedPages.map((p) => (
                  <li key={p.url} className="break-all">
                    {ROLE_LABEL[p.role]} : {p.url} — {p.ok ? "analysée" : `non analysée (${p.reason})`}
                  </li>
                ))}
              </ul>
            </div>
            {skipped > 0 && (
              <p className="text-sm text-muted-foreground">
                {plural(skipped, "page sélectionnée", "pages sélectionnées")} {agree(skipped, "n'a pas été analysée", "n'ont pas été analysées")} : la durée maximale de l&apos;audit a été atteinte.
              </p>
            )}
            {report.notVerified.length > 0 && (
              <div className="space-y-1 text-sm">
                <h3 className="font-semibold">Critères non vérifiés ({report.notVerified.length})</h3>
                <p className="text-muted-foreground">Ils ne rapportent ni ne retirent de points : aucune conclusion n&apos;est tirée sans donnée.</p>
                <ul className="list-disc space-y-1 pl-5">
                  {report.notVerified.map((n) => (
                    <li key={n.code}>
                      <span className="font-medium">{n.label}</span> — {n.reason.replace(/^Non vérifié : /, "")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-1 text-sm">
              <h3 className="font-semibold">Comment le score est calculé</h3>
              <p className="text-muted-foreground">{report.method}</p>
              <p className="text-xs text-muted-foreground">Barème {report.scoringVersion}.</p>
            </div>
          </section>
        </>
      )}
    </article>
  );
}
