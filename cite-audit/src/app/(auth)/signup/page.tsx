import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { signUpAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const inviteOnly = getAccessEnv().SIGNUP_MODE === "invite";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer un compte</CardTitle>
        <CardDescription>
          {inviteOnly
            ? "Inscription sur invitation : seules les adresses autorisées peuvent créer un compte."
            : "Vos projets et vos audits restent privés."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="signup" action={signUpAction} />
        <p className="mt-3 text-center text-xs text-muted-foreground">
          En créant un compte, vous acceptez les{" "}
          <Link className="underline" href="/conditions">
            conditions d&apos;utilisation
          </Link>{" "}
          et la{" "}
          <Link className="underline" href="/confidentialite">
            politique de confidentialité
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
