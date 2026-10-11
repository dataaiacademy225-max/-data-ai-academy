import type { Metadata } from "next";
import { ProjectForm } from "@/components/project/project-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/session";
import { createProjectAction } from "@/server/actions/projects";

export const metadata: Metadata = { title: "Nouveau projet" };

export default async function NewProjectPage() {
  await requireUser();
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Nouveau projet</CardTitle>
        <CardDescription>
          Ces informations servent à vérifier si votre site exprime clairement votre offre, votre cible et votre
          localisation. Elles restent privées.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProjectForm action={createProjectAction} />
      </CardContent>
    </Card>
  );
}
