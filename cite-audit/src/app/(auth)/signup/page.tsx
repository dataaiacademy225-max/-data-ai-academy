import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/session";
import { signUpAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer un compte</CardTitle>
        <CardDescription>Vos projets et vos audits restent privés.</CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="signup" action={signUpAction} />
      </CardContent>
    </Card>
  );
}
