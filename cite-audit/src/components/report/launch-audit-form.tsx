"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { LaunchAuditState } from "@/server/actions/audits";

export function LaunchAuditForm({ action }: { action: (prev: LaunchAuditState) => Promise<LaunchAuditState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-2">
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Mise en file d'attente…" : "Lancer l'audit du site"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
