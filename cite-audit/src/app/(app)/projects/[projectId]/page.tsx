import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LaunchAuditForm } from "@/components/report/launch-audit-form";
import { ScoreTrendCard } from "@/components/report/score-trend";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/session";
import { COUNTRIES } from "@/lib/validation/countries";
import { launchAuditAction } from "@/server/actions/audits";
import { buildScoreTrend } from "@/server/report/trend";
import { listAudits } from "@/server/services/audits";
import { getProject } from "@/server/services/projects";

export const metadata: Metadata = { title: "Projet" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const STATUS_LABEL: Record<string, string> = {
  QUEUED: "En file d'attente",
  RUNNING: "En cours",
  SUCCEEDED: "Terminé",
  PARTIAL: "Terminé, score non vérifié",
  FAILED: "Échec",
  CANCELED: "Annulé",
};

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await requireUser();
  const project = await getProject(user.id, projectId);
  if (!project) notFound();
  const audits = await listAudits(user.id, project.id);
  const country = COUNTRIES.find((c) => c.code === project.country)?.name ?? project.country;

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
        ← Tableau de bord
      </Link>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-2xl">{project.companyName}</CardTitle>
            {project.isDemo ? (
              <Badge variant="demo">Démo</Badge>
            ) : (
              <Link href={`/projects/${project.id}/settings`} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
                Modifier ou supprimer
              </Link>
            )}
          </div>
          <CardDescription className="break-all">{project.siteUrl}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Secteur</dt>
              <dd>{project.sector}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Localisation</dt>
              <dd>{project.city ? `${project.city}, ${country}` : country}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Cible principale</dt>
              <dd>{project.primaryTarget}</dd>
            </div>
          </dl>
          {project.isDemo ? (
            <p className="rounded-md border border-accent/60 bg-accent/10 p-3">
              Projet de démonstration aux données fictives : il ne peut pas être audité.
            </p>
          ) : (
            <div className="space-y-1">
              <LaunchAuditForm action={launchAuditAction.bind(null, project.id)} />
              <p className="text-xs text-muted-foreground">
                L&apos;audit explore jusqu&apos;à 15 pages publiques (accueil, offres, à propos, contact, références…) dans le
                respect du fichier robots.txt du site. Comptez une à trois minutes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Link
        href={`/projects/${project.id}/ai-visibility`}
        className="block rounded-md border border-border bg-card p-4 hover:bg-muted"
      >
        <p className="font-semibold">Visibilité dans les réponses des IA (facultatif) →</p>
        <p className="text-sm text-muted-foreground">
          Observer si votre marque est mentionnée, citée ou recommandée par un assistant IA sur vos questions de prospects.
          Mesure indicative.
        </p>
      </Link>

      <Link
        href={`/projects/${project.id}/comparaison`}
        className="block rounded-md border border-border bg-card p-4 hover:bg-muted"
      >
        <p className="font-semibold">Comparaison avec vos concurrents →</p>
        <p className="text-sm text-muted-foreground">
          Le même audit CITE sur vos concurrents, côte à côte : ce qu&apos;ils font et pas vous, et vos avantages.
          Comparaison indicative de signaux observables.
        </p>
      </Link>

      <ScoreTrendCard trend={buildScoreTrend(audits)} />

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Historique des audits</h2>
        {audits.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun audit pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {audits.map((a) => (
              <li key={a.id}>
                <Link href={`/projects/${project.id}/audits/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-muted">
                  <span>{dateTime.format(a.queuedAt)}</span>
                  <span className="text-sm text-muted-foreground">{STATUS_LABEL[a.status]}</span>
                  <span className="font-semibold">{a.scoreTotal !== null ? `${a.scoreTotal} / 100` : "Non vérifié"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
