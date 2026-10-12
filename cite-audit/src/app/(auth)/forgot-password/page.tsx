import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requestPasswordResetAction } from "@/server/actions/password";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mot de passe oublié</CardTitle>
        <CardDescription>Indiquez l&apos;adresse de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.</CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm action={requestPasswordResetAction} />
      </CardContent>
    </Card>
  );
}
