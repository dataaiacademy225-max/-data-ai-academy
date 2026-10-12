import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resetPasswordAction } from "@/server/actions/password";

export const metadata: Metadata = { title: "Nouveau mot de passe", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouveau mot de passe</CardTitle>
        <CardDescription>Toutes vos sessions ouvertes seront fermées après le changement.</CardDescription>
      </CardHeader>
      <CardContent>
        {typeof token === "string" && token ? (
          <ResetPasswordForm action={resetPasswordAction} token={token} />
        ) : (
          <p className="text-sm">
            Lien incomplet.{" "}
            <Link className="font-medium underline" href="/forgot-password">
              Demander un nouveau lien
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
