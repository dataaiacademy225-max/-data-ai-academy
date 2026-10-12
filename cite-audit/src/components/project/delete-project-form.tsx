"use client";

import { useActionState } from "react";
import type { DeleteProjectState } from "@/server/actions/projects";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function DeleteProjectForm({
  action,
  companyName,
}: {
  action: (prev: DeleteProjectState, formData: FormData) => Promise<DeleteProjectState>;
  companyName: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <FormField id="confirmation" label={`Pour confirmer, saisissez le nom de l'entreprise : ${companyName}`} errors={state.error ? [state.error] : undefined}>
        <Input id="confirmation" name="confirmation" autoComplete="off" aria-invalid={state.error ? true : undefined} />
      </FormField>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Suppression…" : "Supprimer définitivement le projet"}
      </Button>
    </form>
  );
}
