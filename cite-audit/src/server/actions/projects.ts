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
import { logger } from "@/lib/logger";
import { createProject, deleteProject, getProject, MAX_PROJECTS_PER_USER, updateProject } from "@/server/services/projects";

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
  } catch (error) {
    logger.error("projects.create_failed", { error });
    return { error: "Le projet n'a pas pu être enregistré. Réessayez.", values };
  }
  redirect("/dashboard");
}

const PROJECT_ID = /^[a-z0-9]{10,40}$/i;

export async function updateProjectAction(
  projectId: string,
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const user = await requireUser();
  const values = projectFormDataToValues(formData);
  const parsed = projectFormSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: projectFieldErrors(parsed.error), values };
  if (!PROJECT_ID.test(projectId) || !(await updateProject(user.id, projectId, parsed.data))) {
    return { error: "Projet introuvable ou non modifiable.", values };
  }
  redirect(`/projects/${projectId}`);
}

export type DeleteProjectState = { error?: string };

/** Suppression définitive : l'utilisateur doit retaper le nom de l'entreprise. */
export async function deleteProjectAction(projectId: string, _prev: DeleteProjectState, formData: FormData): Promise<DeleteProjectState> {
  const user = await requireUser();
  const project = PROJECT_ID.test(projectId) ? await getProject(user.id, projectId) : null;
  if (!project || project.isDemo) return { error: "Projet introuvable ou non supprimable." };
  const typed = formData.get("confirmation");
  const normalize = (v: string) => v.trim().toLowerCase();
  if (typeof typed !== "string" || normalize(typed) !== normalize(project.companyName)) {
    return { error: "Le nom saisi ne correspond pas : le projet n'a pas été supprimé." };
  }
  await deleteProject(user.id, projectId);
  logger.info("projects.deleted", { projectId });
  redirect("/dashboard");
}
