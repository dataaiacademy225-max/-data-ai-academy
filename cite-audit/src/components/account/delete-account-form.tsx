"use client";

import { useActionState } from "react";
import type { DeleteAccountState } from "@/server/actions/account";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function DeleteAccountForm({
  action,
}: {
  action: (prev: DeleteAccountState, formData: FormData) => Promise<DeleteAccountState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <FormField id="password" label="Mot de passe actuel">
        <Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
      </FormField>
      <FormField
        id="confirmation"
        label="Pour confirmer, saisissez SUPPRIMER"
        errors={state.error ? [state.error] : undefined}
      >
        <Input id="confirmation" name="confirmation" autoComplete="off" aria-invalid={state.error ? true : undefined} />
      </FormField>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Suppression…" : "Supprimer définitivement mon compte"}
      </Button>
    </form>
  );
}
