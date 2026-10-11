"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { runHomepageAudit, type LaunchError } from "@/server/services/audits";

export type LaunchAuditState = { error?: string };

const MESSAGES: Record<LaunchError, string> = {
  NOT_FOUND: "Projet introuvable.",
  DEMO_PROJECT: "Les projets de démonstration ne peuvent pas être audités : créez un projet avec votre propre site.",
  QUOTA: "Limite d'audits atteinte pour aujourd'hui. Réessayez demain.",
  ALREADY_RUNNING: "Un audit est déjà en cours pour ce projet. Patientez quelques instants.",
  INTERNAL: "L'audit n'a pas pu aboutir. Réessayez dans quelques minutes.",
};

export async function launchAuditAction(projectId: string): Promise<LaunchAuditState> {
  const user = await requireUser();
  if (typeof projectId !== "string" || !/^[a-z0-9]{10,40}$/i.test(projectId)) return { error: MESSAGES.NOT_FOUND };
  const result = await runHomepageAudit(user.id, projectId);
  if (!result.ok) return { error: MESSAGES[result.error] };
  redirect(`/projects/${projectId}/audits/${result.auditId}`);
}
