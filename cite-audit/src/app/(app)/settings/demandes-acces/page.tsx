import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2Icon, CircleDotIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isOwner } from "@/lib/access";
import { requireUser } from "@/lib/session";
import { setAccessRequestHandledAction } from "@/server/actions/access-request";
import { ACCESS_REQUEST_RETENTION_DAYS, listAccessRequests } from "@/server/services/access-requests";

export const metadata: Metadata = { title: "Demandes d'accès" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

export default async function AccessRequestsPage() {
  const user = await requireUser();
  if (!isOwner(user)) notFound();
  const requests = await listAccessRequests();
  const pending = requests.filter((r) => !r.handledAt).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Demandes d&apos;accès</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Envoyées depuis le formulaire public. Pour inviter quelqu&apos;un : ajoutez son adresse à{" "}
          <code className="rounded bg-muted px-1">SIGNUP_ALLOWED_EMAILS</code> sur Render, puis envoyez-lui le lien{" "}
          <code className="rounded bg-muted px-1">/signup</code>. Les demandes sont supprimées automatiquement après{" "}
          {Math.round(ACCESS_REQUEST_RETENTION_DAYS / 30)} mois.
        </p>
        <p className="mt-2 text-sm">
          <strong>{pending}</strong> à traiter sur {requests.length}.
        </p>
      </div>

      {requests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucune demande pour l&apos;instant.
        </p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-card/80 p-5 transition-colors duration-300 hover:border-white/15">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold break-words">{r.name}</p>
                  <p className="text-sm break-all text-muted-foreground">{r.email}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm">
                  {r.handledAt ? (
                    <>
                      <CheckCircle2Icon className="size-4 text-emerald-400" aria-hidden="true" /> Traitée
                    </>
                  ) : (
                    <>
                      <CircleDotIcon className="size-4 text-accent" aria-hidden="true" /> À traiter
                    </>
                  )}
                </span>
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Entreprise</dt>
                  <dd className="break-words">{r.company ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Site (non vérifié, non visité)</dt>
                  <dd className="break-all">{r.siteUrl ?? "—"}</dd>
                </div>
                {r.message && (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Message</dt>
                    <dd className="break-words whitespace-pre-line">{r.message}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Reçue le {dateTime.format(r.createdAt)}</span>
                <form action={setAccessRequestHandledAction.bind(null, r.id, !r.handledAt)}>
                  <Button type="submit" variant="outline" size="sm">
                    {r.handledAt ? "Remettre à traiter" : "Marquer comme traitée"}
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
