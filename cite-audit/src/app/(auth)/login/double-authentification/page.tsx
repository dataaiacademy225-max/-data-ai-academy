import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TwoFactorLoginForm } from "@/components/auth/two-factor-login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@/lib/brand";
import { getCurrentUser } from "@/lib/session";
import { verifyTwoFactorLoginAction } from "@/server/actions/two-factor";

export const metadata: Metadata = { title: "Double authentification" };

export default async function TwoFactorLoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Double authentification</CardTitle>
        <CardDescription>
          Mot de passe correct. Ouvrez votre application d&apos;authentification et saisissez le code affiché pour{" "}
          {APP_NAME}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TwoFactorLoginForm action={verifyTwoFactorLoginAction} />
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Téléphone perdu ? Utilisez l&apos;un de vos codes de secours (chacun ne sert qu&apos;une fois).{" "}
          <Link className="underline hover:text-foreground" href="/login">
            Recommencer la connexion
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
