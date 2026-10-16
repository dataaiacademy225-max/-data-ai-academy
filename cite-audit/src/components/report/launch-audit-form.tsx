"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { LaunchAuditState } from "@/server/actions/audits";

export function LaunchAuditForm({
  action,
  label = "Lancer l'audit du site",
  variant = "accent",
}: {
  action: (prev: LaunchAuditState) => Promise<LaunchAuditState>;
  label?: string;
  variant?: "accent" | "outline";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-2">
      <Button type="submit" variant={variant} disabled={pending}>
        {pending ? "Mise en file d'attente…" : label}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
