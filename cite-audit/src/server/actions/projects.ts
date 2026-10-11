"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  projectFieldErrors,
  projectFormDataToValues,
  projectFormSchema,
  type ProjectFieldErrors,
} from "@/lib/validation/project";
import { createProject, MAX_PROJECTS_PER_USER } from "@/server/services/projects";

export type ProjectFormState = {
  error?: string;
  fieldErrors?: ProjectFieldErrors;
  values?: Record<string, string | undefined>;
};

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  // Toujours vérifier la session ici : une server action est appelable directement, hors formulaire.
  const user = await requireUser();
  const values = projectFormDataToValues(formData);

  const parsed = projectFormSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: projectFieldErrors(parsed.error), values };
  }

  const count = await prisma.project.count({ where: { userId: user.id, isDemo: false } });
  if (count >= MAX_PROJECTS_PER_USER) {
    return { error: `Limite de ${MAX_PROJECTS_PER_USER} projets atteinte.`, values };
  }

  try {
    await createProject(user.id, parsed.data);
  } catch {
    console.error("[projects] échec de création de projet");
    return { error: "Le projet n'a pas pu être enregistré. Réessayez.", values };
  }
  redirect("/dashboard");
}
