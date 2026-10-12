import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteProjectForm } from "@/components/project/delete-project-form";
import { ProjectForm } from "@/components/project/project-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/session";
import { deleteProjectAction, updateProjectAction } from "@/server/actions/projects";
import { getProject, projectToFormValues } from "@/server/services/projects";

export const metadata: Metadata = { title: "Paramètres du projet" };

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await requireUser();
  const project = await getProject(user.id, projectId);
  if (!project || project.isDemo) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/projects/${project.id}`} className="text-sm text-muted-foreground hover:underline">
        ← {project.companyName}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Modifier le projet</CardTitle>
          <CardDescription>
            Les audits déjà réalisés ne changent pas : ils gardent les informations du projet au moment de leur lancement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm
            action={updateProjectAction.bind(null, project.id)}
            initialValues={projectToFormValues(project)}
            submitLabel="Enregistrer les modifications"
            cancelHref={`/projects/${project.id}`}
          />
        </CardContent>
      </Card>
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle>Supprimer le projet</CardTitle>
          <CardDescription>
            Supprime définitivement le projet, tous ses audits, les pages analysées, les recommandations et les mesures de
            visibilité IA. Cette action est irréversible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteProjectForm action={deleteProjectAction.bind(null, project.id)} companyName={project.companyName} />
        </CardContent>
      </Card>
    </div>
  );
}
