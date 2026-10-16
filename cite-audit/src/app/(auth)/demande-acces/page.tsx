import type { Metadata } from "next";
import { AccessRequestForm } from "@/components/auth/access-request-form";
import { readTracking } from "@/lib/acquisition";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requestAccessAction } from "@/server/actions/access-request";

export const metadata: Metadata = { title: "Demander un accès" };

export default async function AccessRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Provenance du lien cliqué (ex. ?utm_source=linkedin&utm_campaign=post-1), conservée dans des champs cachés.
  const tracking = readTracking(await searchParams);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Demander un accès</CardTitle>
        <CardDescription>
          GriotCite est ouvert sur invitation pendant la phase pilote. Présentez-vous en quelques mots : nous revenons
          vers vous par e-mail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AccessRequestForm action={requestAccessAction} tracking={tracking} />
      </CardContent>
    </Card>
  );
}
