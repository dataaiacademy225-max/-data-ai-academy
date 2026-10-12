"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { PasswordFormState } from "@/server/actions/password";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm({
  action,
}: {
  action: (prev: PasswordFormState, formData: FormData) => Promise<PasswordFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.sent) {
    return (
      <div role="status" className="space-y-3 text-sm">
        <p>
          Si un compte existe avec cette adresse, un e-mail vient d&apos;être envoyé. Le lien est valable 1 heure.
        </p>
        <p className="text-muted-foreground">Pensez à vérifier vos courriers indésirables.</p>
        <Link className="font-medium underline" href="/login">
          Retour à la connexion
        </Link>
      </div>
    );
  }
  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {state.error}
        </p>
      )}
      <FormField id="email" label="Adresse e-mail du compte" errors={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} aria-invalid={!!state.fieldErrors?.email} />
      </FormField>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Envoi…" : "Recevoir un lien"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link className="font-medium text-foreground underline" href="/login">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
