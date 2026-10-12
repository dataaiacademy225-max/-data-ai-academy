import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/session";
import { signInAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ compte?: string | string[]; motdepasse?: string | string[] }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { compte, motdepasse } = await searchParams;
  return (
    <Card>
      {compte === "supprime" && (
        <p role="status" className="border-b border-border px-6 py-3 text-sm">
          Votre compte et toutes ses données ont été supprimés.
        </p>
      )}
      {motdepasse === "modifie" && (
        <p role="status" className="border-b border-border px-6 py-3 text-sm">
          Mot de passe changé. Connectez-vous avec le nouveau mot de passe.
        </p>
      )}
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Accédez à vos projets et à vos audits.</CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="signin" action={signInAction} />
        <p className="mt-3 text-center text-sm">
          <Link className="text-muted-foreground underline hover:text-foreground" href="/forgot-password">
            Mot de passe oublié ?
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
