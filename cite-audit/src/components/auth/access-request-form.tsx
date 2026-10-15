"use client";

import Link from "next/link";
import { CheckCircle2Icon } from "lucide-react";
import { useActionState } from "react";
import type { AccessRequestFormState } from "@/server/actions/access-request";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function AccessRequestForm({
  action,
}: {
  action: (prev: AccessRequestFormState, formData: FormData) => Promise<AccessRequestFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};

  if (state.sent) {
    return (
      <div role="status" className="space-y-3 text-center">
        <CheckCircle2Icon className="mx-auto size-10 text-emerald-400" aria-hidden="true" />
        <p className="font-display text-lg font-semibold">Demande envoyée</p>
        <p className="text-sm text-muted-foreground">
          Merci. Nous étudions chaque demande et revenons vers vous par e-mail avec votre lien d&apos;inscription si
          l&apos;accès vous est ouvert.
        </p>
        <Link href="/" className="inline-block text-sm text-muted-foreground underline hover:text-foreground">
          Retour à l&apos;accueil
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
      <FormField id="name" label="Nom complet" errors={errors.name}>
        <Input id="name" name="name" autoComplete="name" required defaultValue={state.values?.name} aria-invalid={!!errors.name} />
      </FormField>
      <FormField id="email" label="Adresse e-mail professionnelle" errors={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          aria-invalid={!!errors.email}
        />
      </FormField>
      <FormField id="company" label="Entreprise" optional errors={errors.company}>
        <Input id="company" name="company" autoComplete="organization" defaultValue={state.values?.company} aria-invalid={!!errors.company} />
      </FormField>
      <FormField id="siteUrl" label="Adresse de votre site" optional errors={errors.siteUrl}>
        <Input
          id="siteUrl"
          name="siteUrl"
          inputMode="url"
          placeholder="monsite.com"
          defaultValue={state.values?.siteUrl}
          aria-invalid={!!errors.siteUrl}
        />
      </FormField>
      <FormField id="message" label="Votre besoin" optional errors={errors.message}>
        <Textarea id="message" name="message" rows={3} maxLength={1000} defaultValue={state.values?.message} aria-invalid={!!errors.message} />
      </FormField>

      {/* Champ piège pour les robots : invisible et ignoré par les lecteurs d'écran. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="fax">Ne pas remplir</label>
        <input id="fax" name="fax" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-1.5">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" className="mt-1 size-4 accent-[#ff7a29]" aria-invalid={!!errors.consent} />
          <span>
            J&apos;accepte que ces informations soient utilisées pour traiter ma demande, et conservées 12 mois au plus
            (voir la{" "}
            <Link href="/confidentialite" className="underline">
              politique de confidentialité
            </Link>
            ).
          </span>
        </label>
        {errors.consent?.map((message) => (
          <p key={message} className="text-xs text-destructive" role="alert">
            {message}
          </p>
        ))}
      </div>

      <Button type="submit" variant="accent" className="w-full" disabled={pending}>
        {pending ? "Envoi…" : "Envoyer ma demande"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Déjà invité ?{" "}
        <Link href="/signup" className="font-medium text-foreground underline">
          Créer mon compte
        </Link>
      </p>
    </form>
  );
}
