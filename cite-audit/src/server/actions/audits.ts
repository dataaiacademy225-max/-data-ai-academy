"use server";

import { redirect } from "next/navigation";
import { isOwner } from "@/lib/access";
import { requireUser } from "@/lib/session";
import { requestAudit, type LaunchError } from "@/server/services/audits";

export type LaunchAuditState = { error?: string };

const MESSAGES: Record<LaunchError, string> = {
  NOT_FOUND: "Projet introuvable.",
  DEMO_PROJECT: "Les projets de démonstration ne peuvent pas être audités : créez un projet avec votre propre site.",
  QUOTA: "Limite d'audits atteinte pour aujourd'hui. Réessayez demain.",
  ALREADY_RUNNING: "Un audit est déjà en attente ou en cours pour ce projet.",
};

export async function launchAuditAction(projectId: string): Promise<LaunchAuditState> {
  const user = await requireUser();
  if (typeof projectId !== "string" || !/^[a-z0-9]{10,40}$/i.test(projectId)) return { error: MESSAGES.NOT_FOUND };
  // Compte propriétaire : pas de limite d'audits par jour (un seul audit en cours par projet reste la règle).
  const result = await requestAudit(user.id, projectId, isOwner(user) ? { dailyLimit: null } : {});
  if (!result.ok) return { error: MESSAGES[result.error] };
  redirect(`/projects/${projectId}/audits/${result.auditId}`);
}
