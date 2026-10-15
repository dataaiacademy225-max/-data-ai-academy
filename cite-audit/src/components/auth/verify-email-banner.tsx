"use client";

import { useActionState } from "react";
import type { VerificationState } from "@/server/actions/password";
import { Button } from "@/components/ui/button";

export function VerifyEmailBanner({
  action,
}: {
  action: (prev: VerificationState, formData: FormData) => Promise<VerificationState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <div role="status" className="border-b border-border bg-accent/10">
      <form action={formAction} className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
        <span aria-hidden="true">✉️</span>
        <span>Adresse e-mail non confirmée : ouvrez le lien reçu à l&apos;inscription.</span>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Envoi…" : "Renvoyer l'e-mail"}
        </Button>
        {state.message && <span>{state.message}</span>}
        {state.error && <span className="text-destructive">{state.error}</span>}
      </form>
    </div>
  );
}
