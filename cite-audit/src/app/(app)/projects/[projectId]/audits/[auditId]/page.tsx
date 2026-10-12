import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditProgress } from "@/components/report/audit-progress";
import { PillarSection } from "@/components/report/pillar-section";
import { PrintButton } from "@/components/report/print-button";
import { RecommendationCard } from "@/components/report/recommendation-card";
import { PillarMeter, ScoreHero } from "@/components/report/score-summary";
import { PriorityBadge } from "@/components/report/labels";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/session";
import type { PageRole, Pillar, Priority } from "@/server/scoring/types";
import { getAuditReport } from "@/server/services/audits";

export const metadata: Metadata = { title: "Rapport d'audit" };

const PILLAR_ORDER: Pillar[] = ["CLARIFIER", "INDEXER", "TUNNEL", "ENCLENCHER"];
const PRIORITY_SECTIONS: { priority: Priority; title: string; intro: string }[] = [
  { priority: "CRITIQUE", title: "À traiter en premier", intro: "Ces points peuvent empêcher d'être trouvé, compris ou contacté." },
  { priority: "IMPORTANT", title: "Ensuite", intro: "Ces points réduisent nettement la compréhension ou la conversion." },
  { priority: "RECOMMANDE", title: "Pour aller plus loin", intro: "Des optimisations utiles mais non bloquantes." },
];
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
          {/* 1. Synthèse exécutive : lisible en moins d'une minute */}
          <section aria-labelledby="synthese" className="space-y-6 rounded-md border border-border bg-card p-6">
            <h2 id="synthese" className="font-display text-2xl font-semibold">
              Synthèse
            </h2>
            <div className="grid gap-8 md:grid-cols-[minmax(0,14rem)_1fr]">
              <ScoreHero report={report} />
              <div className="grid gap-5 sm:grid-cols-2">
                {PILLAR_ORDER.map((p) => (
                  <PillarMeter key={p} pillar={report.pillars[p]} />
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <h3 className="mb-2 font-semibold">Vos forces</h3>
                {report.strengths.length ? (
                  <ul className="space-y-2 text-sm">
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
              <div>
                <h3 className="mb-2 font-semibold">Vos faiblesses</h3>
                {report.weaknesses.length ? (
                  <ul className="space-y-2 text-sm">
                    {report.weaknesses.slice(0, 3).map((w) => (
                      <li key={w.criterionCode} className="space-y-1">
                        <PriorityBadge priority={w.priority} /> <span className="font-medium">{w.title}</span>
                        <p className="text-muted-foreground">{w.detail}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{nothingMeasured ? NOTHING : "Aucune faiblesse relevée sur les critères mesurés."}</p>
                )}
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Vos 3 actions prioritaires</h3>
                {report.recommendations.length ? (
                  <ol className="list-decimal space-y-2 pl-5 text-sm">
                    {report.recommendations.slice(0, 3).map((r) => (
                      <li key={r.criterionCode}>{r.recommendation}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">{nothingMeasured ? NOTHING : "Aucune action prioritaire sur les critères mesurés."}</p>
                )}
              </div>
            </div>

            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{report.disclaimer}</p>
          </section>

          {/* 2. Plan d'action */}
          {report.recommendations.length > 0 && (
            <section aria-labelledby="plan" className="space-y-6">
              <h2 id="plan" className="font-display text-2xl font-semibold">
                Plan d&apos;action
              </h2>
              {PRIORITY_SECTIONS.map(({ priority, title, intro }) => {
                const recs = report.recommendations.filter((r) => r.priority === priority);
                if (recs.length === 0) return null;
                return (
                  <div key={priority} className="space-y-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-semibold">
                        {title} <PriorityBadge priority={priority} />
                      </h3>
                      <p className="text-sm text-muted-foreground">{intro}</p>
                    </div>
                    <div className="grid gap-3">
                      {recs.map((r) => (
                        <RecommendationCard key={r.criterionCode} rec={r} />
                      ))}
                    </div>
                  </div>
                );
              })}
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
                {skipped} page(s) sélectionnée(s) n&apos;ont pas été analysées : la durée maximale de l&apos;audit a été atteinte.
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
