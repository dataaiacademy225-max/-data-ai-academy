import type { Metadata } from "next";
import { DeleteAccountForm } from "@/components/account/delete-account-form";
import { TwoFactorManage, TwoFactorSetup } from "@/components/account/two-factor-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isDesignatedOwner } from "@/lib/access";
import { requireUser } from "@/lib/session";
import { deleteAccountAction } from "@/server/actions/account";
import {
  confirmTwoFactorSetupAction,
  disableTwoFactorAction,
  regenerateBackupCodesAction,
  startTwoFactorSetupAction,
} from "@/server/actions/two-factor";

export const metadata: Metadata = { title: "Mon compte" };

const TWO_FACTOR_MESSAGES: Record<string, string> = {
  activee: "Double authentification activée. Le code de l'application sera demandé à chaque connexion.",
  desactivee: "Double authentification désactivée.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ "double-authentification"?: string | string[] }>;
}) {
  const user = await requireUser();
  const status = (await searchParams)["double-authentification"];
  const statusMessage = typeof status === "string" ? TWO_FACTOR_MESSAGES[status] : undefined;
  const designatedOwner = isDesignatedOwner(user);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold">Mon compte</h1>
      {statusMessage && (
        <p role="status" className="rounded-md border border-border bg-card p-3 text-sm">
          {statusMessage}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Nom : </span>
            {user.name}
          </p>
          <p>
            <span className="text-muted-foreground">E-mail : </span>
            {user.email}
          </p>
        </CardContent>
      </Card>
      <Card id="double-authentification">
        <CardHeader>
          <CardTitle>Double authentification</CardTitle>
          <CardDescription>
            {user.twoFactorEnabled ? (
              <>
                <span aria-hidden="true">✅ </span>
                <strong>Active.</strong> À chaque connexion, le code de votre application d&apos;authentification est
                demandé en plus du mot de passe.
              </>
            ) : (
              <>
                En plus du mot de passe, un code à 6 chiffres donné par une application sur votre téléphone. Un mot de
                passe volé ne suffit plus pour entrer dans votre compte.
                {designatedOwner && " Obligatoire pour les droits propriétaire (audits illimités)."}
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.twoFactorEnabled ? (
            <TwoFactorManage
              regenerateAction={regenerateBackupCodesAction}
              disableAction={disableTwoFactorAction}
              ownerWarning={designatedOwner}
            />
          ) : (
            <TwoFactorSetup startAction={startTwoFactorSetupAction} confirmAction={confirmTwoFactorSetupAction} />
          )}
        </CardContent>
      </Card>
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle>Supprimer mon compte</CardTitle>
          <CardDescription>
            Supprime définitivement votre compte et toutes vos données : projets, audits, pages analysées,
            recommandations et mesures de visibilité IA. Cette action est irréversible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountForm action={deleteAccountAction} />
        </CardContent>
      </Card>
    </div>
  );
}
