"use server";

import { redirect } from "next/navigation";
import { isOwner } from "@/lib/access";
import { requireUser } from "@/lib/session";
import type { LaunchAuditState } from "@/server/actions/audits";
import { requestComparison, type ComparisonLaunchError } from "@/server/services/comparisons";

const MESSAGES: Record<ComparisonLaunchError, string> = {
  NOT_FOUND: "Projet introuvable.",
  DEMO_PROJECT: "Les projets de démonstration ne peuvent pas lancer de comparaison : créez un projet avec votre propre site.",
  NO_COMPETITOR_URL:
    "Aucun concurrent avec une adresse de site. Ajoutez-en dans les paramètres du projet, une ligne par concurrent : « Nom | https://site.com ».",
  QUOTA: "Limite d'audits atteinte pour aujourd'hui (chaque concurrent compte pour un audit). Réessayez demain.",
  ALREADY_RUNNING: "Une comparaison est déjà en attente ou en cours pour ce projet.",
};

export async function launchComparisonAction(projectId: string): Promise<LaunchAuditState> {
  const user = await requireUser();
  if (typeof projectId !== "string" || !/^[a-z0-9]{10,40}$/i.test(projectId)) return { error: MESSAGES.NOT_FOUND };
  // Compte propriétaire : pas de limite par jour, comme pour les audits.
  const result = await requestComparison(user.id, projectId, isOwner(user) ? { dailyLimit: null } : {});
  if (!result.ok) return { error: MESSAGES[result.error] };
  redirect(`/projects/${projectId}/comparaison`);
}
