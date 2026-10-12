import type { Metadata } from "next";
import { DeleteAccountForm } from "@/components/account/delete-account-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/session";
import { deleteAccountAction } from "@/server/actions/account";

export const metadata: Metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold">Mon compte</h1>
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
