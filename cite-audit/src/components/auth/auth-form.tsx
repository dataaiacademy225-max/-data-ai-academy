"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { z } from "zod";
import type { AuthFormState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

type Mode = "signin" | "signup";

const schemas: Record<Mode, z.ZodType> = { signin: signInSchema, signup: signUpSchema };

export function AuthForm({
  mode,
  action,
}: {
  mode: Mode;
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [clientErrors, setClientErrors] = useState<Record<string, string[] | undefined>>({});

  // Validation immédiate côté client ; le serveur revalide de toute façon.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = schemas[mode].safeParse(values);
    if (!result.success) {
      event.preventDefault();
      setClientErrors(z.flattenError(result.error).fieldErrors as Record<string, string[] | undefined>);
    } else {
      setClientErrors({});
    }
  }

  const errors = { ...state.fieldErrors, ...clientErrors };
  const isSignup = mode === "signup";

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {state.error}
        </p>
      )}
      {isSignup && (
        <FormField id="name" label="Nom complet" errors={errors.name}>
          <Input id="name" name="name" autoComplete="name" defaultValue={state.values?.name} aria-invalid={!!errors.name} />
        </FormField>
      )}
      <FormField id="email" label="Adresse e-mail" errors={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          aria-invalid={!!errors.email}
        />
      </FormField>
      <FormField
        id="password"
        label="Mot de passe"
        hint={isSignup ? "10 caractères minimum." : undefined}
        errors={errors.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          aria-invalid={!!errors.password}
        />
      </FormField>
      {isSignup && (
        <FormField id="confirmPassword" label="Confirmer le mot de passe" errors={errors.confirmPassword}>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
          />
        </FormField>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Veuillez patienter…" : isSignup ? "Créer mon compte" : "Se connecter"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {isSignup ? (
          <>
            Déjà un compte ? <Link className="font-medium text-foreground underline" href="/login">Se connecter</Link>
          </>
        ) : (
          <>
            Pas encore invité ? <Link className="font-medium text-foreground underline" href="/demande-acces">Demander un accès</Link>
            <span className="mt-1 block">
              Déjà invité ? <Link className="underline" href="/signup">Créer mon compte</Link>
            </span>
          </>
        )}
      </p>
    </form>
  );
}
