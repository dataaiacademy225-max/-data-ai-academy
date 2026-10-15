"use client";

import { useActionState, useMemo, useState } from "react";
import type { AiLaunchState } from "@/server/actions/ai-visibility";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { estimateCost, formatUsd, PRICES_AS_OF } from "@/lib/ai-pricing";
import { parseGeoQueryLines } from "@/lib/validation/project";
import { agree, plural } from "@/lib/plural";

type ProviderInfo = { id: string; label: string; models: { id: string; label: string }[]; defaultModel: string };

export function AiLaunchForm({
  action,
  providers,
  defaultQueries,
  perRun,
  remainingToday,
}: {
  action: (prev: AiLaunchState, formData: FormData) => Promise<AiLaunchState>;
  providers: ProviderInfo[];
  defaultQueries: string;
  perRun: number;
  remainingToday: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const provider = providers[0];
  const [model, setModel] = useState(state.values?.model || provider.defaultModel);
  const [queries, setQueries] = useState(state.values?.queries ?? defaultQueries);

  const parsed = useMemo(() => parseGeoQueryLines(queries), [queries]);
  const estimate = useMemo(() => estimateCost(model, parsed.value), [model, parsed.value]);
  const count = parsed.value.length;
  const tooMany = count > perRun || count > remainingToday;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="provider" value={provider.id} />
      {state.error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {state.error}
        </p>
      )}
      <FormField
        id="queries"
        label="Requêtes à tester"
        hint={`Une question par ligne, telle qu'un prospect la poserait. ${perRun} maximum par lancement.`}
        errors={parsed.errors.length ? parsed.errors : undefined}
      >
        <Textarea id="queries" name="queries" rows={5} value={queries} onChange={(e) => setQueries(e.target.value)} />
      </FormField>
      <FormField id="model" label={`Modèle (${provider.label})`}>
        <Select id="model" name="model" value={model} onChange={(e) => setModel(e.target.value)}>
          {provider.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </FormField>

      <div aria-live="polite" className="rounded-md border border-border bg-muted p-3 text-sm">
        <p>
          <strong>{count}</strong> {agree(count, "requête", "requêtes")} · coût estimé{" "}
          {estimate.known ? (
            <strong>
              entre {formatUsd(estimate.minUsd)} et {formatUsd(estimate.maxUsd)}
            </strong>
          ) : (
            "inconnu pour ce modèle"
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          Estimation indicative fondée sur les tarifs publics relevés en {PRICES_AS_OF} ; le coût réel dépend de la longueur
          des réponses et des recherches effectuées. Il reste {plural(remainingToday, "requête disponible", "requêtes disponibles")} sur 24 h.
        </p>
        {tooMany && <p className="mt-1 text-xs text-destructive">Trop de requêtes pour ce lancement ou pour la limite quotidienne.</p>}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="costAccepted" className="mt-0.5 size-4 accent-[var(--accent)]" />
        <span>
          J&apos;ai pris connaissance du coût estimé, facturé sur le compte du fournisseur configuré sur ce serveur.
        </span>
      </label>
      <Button type="submit" variant="accent" disabled={pending || count === 0 || tooMany || parsed.errors.length > 0}>
        {pending ? "Mise en file d'attente…" : "Lancer la mesure"}
      </Button>
    </form>
  );
}
