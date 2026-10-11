import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiLaunchForm } from "@/components/ai-visibility/launch-form";
import { RunResults } from "@/components/ai-visibility/run-results";
import { AiWarning } from "@/components/ai-visibility/warning";
import { AutoRefresh } from "@/components/report/auto-refresh";
import { requireUser } from "@/lib/session";
import { launchAiRunAction } from "@/server/actions/ai-visibility";
import { getAiModuleStatus, getAiVisibility } from "@/server/services/ai-visibility";

export const metadata: Metadata = { title: "Visibilité IA" };

export default async function AiVisibilityPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await requireUser();
  const data = await getAiVisibility(user.id, projectId);
  if (!data) notFound();
  const { project, runs, usedToday } = data;
  const status = getAiModuleStatus();
  const active = runs.some((r) => r.status === "QUEUED" || r.status === "RUNNING");

  return (
    <div className="space-y-6">
      {active && <AutoRefresh />}
      <Link href={`/projects/${project.id}`} className="text-sm text-muted-foreground hover:underline">
        ← {project.companyName}
      </Link>
      <header className="space-y-2">
        <p className="text-sm font-medium text-accent">Module facultatif</p>
        <h1 className="font-display text-3xl font-bold">Visibilité dans les réponses des IA</h1>
        <p className="text-sm text-muted-foreground">
          Ce module envoie vos questions de prospects à un assistant IA et observe si « {project.companyName} » est{" "}
          <strong>mentionnée</strong> (nom présent), <strong>citée</strong> (une source renvoyée pointe vers votre site) ou{" "}
          <strong>recommandée</strong> (formulation explicite de recommandation). Une mention n&apos;est jamais comptée comme une
          recommandation.
        </p>
      </header>
      <AiWarning />
      <p className="text-sm text-muted-foreground">
        Chaque réponse est un instantané : une seule réponse, ou quelques-unes, ne représentent pas la visibilité globale de la
        marque. Les réponses obtenues par API peuvent aussi différer de celles des applications grand public.
      </p>

      {project.isDemo ? (
        <p className="rounded-md border border-border bg-card p-4 text-sm">Projet de démonstration : seuls des résultats fictifs sont affichés.</p>
      ) : !status.enabled ? (
        <section className="space-y-2 rounded-md border border-border bg-card p-4 text-sm">
          <h2 className="font-semibold">Module non activé</h2>
          <p>
            Aucune clé API n&apos;est configurée sur le serveur. L&apos;administrateur peut activer le module en renseignant{" "}
            <code>PERPLEXITY_API_KEY</code> dans le fichier <code>.env</code> du serveur, puis en redémarrant l&apos;application et le
            worker. La clé reste sur le serveur : elle n&apos;est jamais affichée ni enregistrée en base.
          </p>
        </section>
      ) : (
        <section className="space-y-3 rounded-md border border-border bg-card p-4">
          <h2 className="font-display text-xl font-semibold">Nouvelle mesure</h2>
          <AiLaunchForm
            action={launchAiRunAction.bind(null, project.id)}
            providers={status.providers}
            defaultQueries={project.geoQueries.join("\n")}
            perRun={status.limits.perRun}
            remainingToday={Math.max(0, status.limits.perDay - usedToday)}
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Mesures précédentes</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune mesure pour l&apos;instant.</p>
        ) : (
          runs.map((run) => <RunResults key={run.id} run={run} />)
        )}
      </section>
    </div>
  );
}
