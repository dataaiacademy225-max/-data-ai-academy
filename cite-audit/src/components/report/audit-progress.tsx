import { AutoRefresh } from "@/components/report/auto-refresh";

type Progress = { phase?: string; pagesDone?: number; pagesTotal?: number } | null;

const PHASES: Record<string, string> = {
  queued: "En file d'attente",
  home: "Analyse de la page d'accueil",
  sitemap: "Lecture du plan du site et choix des pages",
  pages: "Analyse des pages",
  done: "Calcul du score",
};

/** Avancement d'un audit en attente ou en cours ; la page se met à jour toute seule. */
export function AuditProgress({ status, progress, queuedForMs }: { status: string; progress: Progress; queuedForMs: number }) {
  const phase = status === "QUEUED" ? "queued" : (progress?.phase ?? "home");
  const done = progress?.pagesDone ?? 0;
  const total = progress?.pagesTotal ?? 0;
  const showCount = phase === "pages" && total > 0;
  const waitingLong = status === "QUEUED" && queuedForMs > 2 * 60 * 1000;

  return (
    <section aria-live="polite" className="space-y-3 rounded-md border border-border bg-card p-6">
      <AutoRefresh />
      <h2 className="font-display text-xl font-semibold">Audit en cours</h2>
      <p>
        {PHASES[phase] ?? "Analyse en cours"}
        {showCount && ` : ${done} / ${total}`}
        <span className="text-muted-foreground"> — cette page se met à jour automatiquement.</span>
      </p>
      {showCount && (
        <div
          role="progressbar"
          aria-label="Pages analysées"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          className="h-2.5 overflow-hidden rounded-full bg-accent/20"
        >
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.max((done / total) * 100, 2)}%` }} />
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Jusqu&apos;à 15 pages sont analysées, une à une, avec une pause entre chaque page pour ne pas surcharger votre site.
        Comptez une à trois minutes.
      </p>
      {waitingLong && (
        <p role="status" className="rounded-md border border-accent/60 bg-accent/10 p-3 text-sm">
          L&apos;analyse n&apos;a pas encore démarré. Si l&apos;attente se prolonge, le service d&apos;analyse (worker) n&apos;est
          peut-être pas lancé.
        </p>
      )}
    </section>
  );
}
