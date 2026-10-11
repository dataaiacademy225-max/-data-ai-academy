"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import type { ProjectFormState } from "@/server/actions/projects";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRIES } from "@/lib/validation/countries";
import {
  PROJECT_LIMITS,
  projectFieldErrors,
  projectFormDataToValues,
  projectFormSchema,
  type ProjectFieldErrors,
} from "@/lib/validation/project";

export function ProjectForm({
  action,
}: {
  action: (prev: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [clientErrors, setClientErrors] = useState<ProjectFieldErrors | null>(null);

  // Même schéma que le serveur : retour immédiat, sans remplacer la validation serveur.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const result = projectFormSchema.safeParse(projectFormDataToValues(new FormData(event.currentTarget)));
    if (!result.success) {
      event.preventDefault();
      setClientErrors(projectFieldErrors(result.error));
    } else {
      setClientErrors(null);
    }
  }

  const errors = clientErrors ?? state.fieldErrors ?? {};
  const v = state.values ?? {};
  // La clé force le remontage du formulaire quand le serveur renvoie des valeurs (React réinitialise le formulaire après l'action).
  const formKey = JSON.stringify(v);
  const invalid = (field: keyof ProjectFieldErrors) => (errors[field] ? true : undefined);

  return (
    <form key={formKey} action={formAction} onSubmit={onSubmit} noValidate className="space-y-5">
      {state.error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {state.error}
        </p>
      )}

      <FormField id="companyName" label="Nom de l'entreprise" errors={errors.companyName}>
        <Input
          id="companyName"
          name="companyName"
          maxLength={PROJECT_LIMITS.companyName.max}
          defaultValue={v.companyName}
          aria-invalid={invalid("companyName")}
        />
      </FormField>

      <FormField
        id="siteUrl"
        label="Adresse du site"
        hint="Le site public à auditer, par exemple https://www.monentreprise.com"
        errors={errors.siteUrl}
      >
        <Input
          id="siteUrl"
          name="siteUrl"
          inputMode="url"
          placeholder="https://"
          maxLength={PROJECT_LIMITS.url.max}
          defaultValue={v.siteUrl}
          aria-invalid={invalid("siteUrl")}
        />
      </FormField>

      <FormField id="sector" label="Secteur" hint="Ex. : cabinet de conseil RH, SaaS de facturation" errors={errors.sector}>
        <Input
          id="sector"
          name="sector"
          maxLength={PROJECT_LIMITS.sector.max}
          defaultValue={v.sector}
          aria-invalid={invalid("sector")}
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="country" label="Pays" errors={errors.country}>
          <Select id="country" name="country" defaultValue={v.country ?? ""} aria-invalid={invalid("country")}>
            <option value="" disabled>
              Choisir…
            </option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="city" label="Ville" optional errors={errors.city}>
          <Input
            id="city"
            name="city"
            maxLength={PROJECT_LIMITS.city.max}
            defaultValue={v.city}
            aria-invalid={invalid("city")}
          />
        </FormField>
      </div>

      <FormField
        id="primaryTarget"
        label="Cible principale"
        hint="Qui voulez-vous convaincre ? Ex. : dirigeants de PME industrielles"
        errors={errors.primaryTarget}
      >
        <Input
          id="primaryTarget"
          name="primaryTarget"
          maxLength={PROJECT_LIMITS.primaryTarget.max}
          defaultValue={v.primaryTarget}
          aria-invalid={invalid("primaryTarget")}
        />
      </FormField>

      <FormField
        id="competitors"
        label="Concurrents"
        optional
        hint={`Un par ligne, ${PROJECT_LIMITS.competitors.max} maximum. Format : Nom | https://site.com (l'adresse est facultative).`}
        errors={errors.competitors}
      >
        <Textarea
          id="competitors"
          name="competitors"
          rows={3}
          defaultValue={v.competitors}
          aria-invalid={invalid("competitors")}
        />
      </FormField>

      <FormField
        id="geoQueries"
        label="Requêtes GEO"
        optional
        hint={`Les questions que vos prospects pourraient poser à une IA. Une par ligne, ${PROJECT_LIMITS.geoQueries.max} maximum.`}
        errors={errors.geoQueries}
      >
        <Textarea
          id="geoQueries"
          name="geoQueries"
          rows={4}
          placeholder="Quel cabinet de conseil en data choisir à Abidjan ?"
          defaultValue={v.geoQueries}
          aria-invalid={invalid("geoQueries")}
        />
      </FormField>

      <div className="space-y-1.5">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="ownershipAttested"
            className="mt-0.5 size-4 accent-[var(--accent)]"
            defaultChecked={v.ownershipAttested === "on"}
            aria-invalid={invalid("ownershipAttested")}
          />
          <span>
            Je confirme être autorisé(e) à faire auditer ce site public (site de mon entreprise ou d&apos;un client
            qui m&apos;a mandaté).
          </span>
        </label>
        {errors.ownershipAttested?.map((m) => (
          <p key={m} className="text-xs text-destructive" role="alert">
            {m}
          </p>
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Annuler
        </Link>
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Enregistrement…" : "Créer le projet"}
        </Button>
      </div>
    </form>
  );
}
