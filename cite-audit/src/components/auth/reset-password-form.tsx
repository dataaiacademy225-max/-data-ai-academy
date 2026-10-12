"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { PasswordFormState } from "@/server/actions/password";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm({
  action,
  token,
}: {
  action: (prev: PasswordFormState, formData: FormData) => Promise<PasswordFormState>;
  token: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.error && (
        <div role="alert" className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p>{state.error}</p>
          <Link className="font-medium underline" href="/forgot-password">
            Demander un nouveau lien
          </Link>
        </div>
      )}
      <input type="hidden" name="token" value={token} />
      <FormField id="password" label="Nouveau mot de passe" hint="10 caractères minimum." errors={errors.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} />
      </FormField>
      <FormField id="confirmPassword" label="Confirmer le mot de passe" errors={errors.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} />
      </FormField>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enregistrement…" : "Changer le mot de passe"}
      </Button>
    </form>
  );
}
