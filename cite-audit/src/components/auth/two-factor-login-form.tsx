"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { TwoFactorLoginState } from "@/server/actions/two-factor";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function TwoFactorLoginForm({
  action,
}: {
  action: (prev: TwoFactorLoginState, formData: FormData) => Promise<TwoFactorLoginState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {state.error}
          {state.expired && (
            <>
              {" "}
              <Link className="font-medium underline" href="/login">
                Retour à la connexion
              </Link>
            </>
          )}
        </p>
      )}
      <FormField
        id="code"
        label="Code de vérification"
        hint="Le code à 6 chiffres de votre application d'authentification, ou un code de secours."
      >
        <Input
          id="code"
          name="code"
          autoComplete="one-time-code"
          inputMode="text"
          autoFocus
          required
          maxLength={32}
          aria-describedby="code-hint"
        />
      </FormField>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Vérification…" : "Valider"}
      </Button>
    </form>
  );
}
