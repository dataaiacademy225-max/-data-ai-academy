"use client";

import { useActionState } from "react";
import type {
  BackupCodesState,
  TwoFactorConfirmState,
  TwoFactorSetupState,
} from "@/server/actions/two-factor";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

type Action<S> = (prev: S, formData: FormData) => Promise<S>;

function ErrorMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
      {message}
    </p>
  );
}

function BackupCodeList({ codes }: { codes: string[] }) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/40 p-4">
      <p className="text-sm font-medium">Vos 10 codes de secours</p>
      <p className="text-xs text-muted-foreground">
        Notez-les sur papier ou dans un gestionnaire de mots de passe. Chacun ne sert qu&apos;une fois, si vous perdez
        votre téléphone. Ils ne seront plus affichés.
      </p>
      <ul className="grid grid-cols-2 gap-1 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
    </div>
  );
}

function PasswordField({ id }: { id: string }) {
  return (
    <FormField id={id} label="Mot de passe actuel">
      <Input id={id} name="password" type="password" autoComplete="current-password" required maxLength={128} />
    </FormField>
  );
}

/** Activation en deux étapes : mot de passe → QR code + codes de secours → premier code de l'application. */
export function TwoFactorSetup({
  startAction,
  confirmAction,
}: {
  startAction: Action<TwoFactorSetupState>;
  confirmAction: Action<TwoFactorConfirmState>;
}) {
  const [setupState, startFormAction, starting] = useActionState(startAction, {});
  const [confirmState, confirmFormAction, confirming] = useActionState(confirmAction, {});
  const setup = setupState.setup;

  if (!setup) {
    return (
      <form action={startFormAction} className="space-y-3">
        <ErrorMessage message={setupState.error} />
        <PasswordField id="two-factor-start-password" />
        <Button type="submit" disabled={starting}>
          {starting ? "Préparation…" : "Activer la double authentification"}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Installez une application d&apos;authentification : Google Authenticator, Microsoft Authenticator…</li>
        <li>Dans l&apos;application, ajoutez un compte en scannant ce QR code.</li>
        <li>Saisissez ci-dessous le code à 6 chiffres affiché par l&apos;application.</li>
      </ol>
      {/* Image générée sur le serveur (data:), sans service externe : next/image n'apporte rien ici. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.qrCode} alt="QR code à scanner avec l'application d'authentification" width={220} height={220} className="rounded-md border border-border bg-white p-2" />
      {setup.manualKey && (
        <p className="text-sm">
          Impossible de scanner ? Saisissez cette clé dans l&apos;application :{" "}
          <span className="break-all font-mono">{setup.manualKey}</span>
        </p>
      )}
      <BackupCodeList codes={setup.backupCodes} />
      <form action={confirmFormAction} className="space-y-3">
        <ErrorMessage message={confirmState.error} />
        <FormField id="two-factor-confirm-code" label="Code affiché par l'application">
          <Input id="two-factor-confirm-code" name="code" autoComplete="one-time-code" inputMode="numeric" required maxLength={32} />
        </FormField>
        <Button type="submit" disabled={confirming}>
          {confirming ? "Vérification…" : "Confirmer et activer"}
        </Button>
      </form>
    </div>
  );
}

/** Double authentification active : nouveaux codes de secours ou désactivation (mot de passe exigé). */
export function TwoFactorManage({
  regenerateAction,
  disableAction,
  ownerWarning,
}: {
  regenerateAction: Action<BackupCodesState>;
  disableAction: Action<TwoFactorConfirmState>;
  ownerWarning: boolean;
}) {
  const [codesState, codesFormAction, generating] = useActionState(regenerateAction, {});
  const [disableState, disableFormAction, disabling] = useActionState(disableAction, {});
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Nouveaux codes de secours</h3>
        <p className="text-sm text-muted-foreground">Les anciens codes cesseront de fonctionner.</p>
        {codesState.backupCodes ? (
          <BackupCodeList codes={codesState.backupCodes} />
        ) : (
          <form action={codesFormAction} className="space-y-3">
            <ErrorMessage message={codesState.error} />
            <PasswordField id="two-factor-codes-password" />
            <Button type="submit" variant="outline" disabled={generating}>
              {generating ? "Génération…" : "Générer de nouveaux codes"}
            </Button>
          </form>
        )}
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Désactiver</h3>
        {ownerWarning && (
          <p className="text-sm">
            <span aria-hidden="true">⚠️ </span>
            Sans double authentification, ce compte perd ses droits propriétaire (audits illimités).
          </p>
        )}
        <form action={disableFormAction} className="space-y-3">
          <ErrorMessage message={disableState.error} />
          <PasswordField id="two-factor-disable-password" />
          <Button type="submit" variant="destructive" disabled={disabling}>
            {disabling ? "Désactivation…" : "Désactiver la double authentification"}
          </Button>
        </form>
      </div>
    </div>
  );
}
