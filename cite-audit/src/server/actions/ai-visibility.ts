"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { parseGeoQueryLines } from "@/lib/validation/project";
import { requestAiRun, type AiLaunchError } from "@/server/services/ai-visibility";

export type AiLaunchState = { error?: string; values?: { queries?: string; model?: string } };

const MESSAGES: Record<AiLaunchError, string> = {
  MODULE_DISABLED: "Le module de visibilité IA n'est pas activé : aucune clé API n'est configurée sur le serveur.",
  UNKNOWN_MODEL: "Modèle non disponible.",
  NOT_FOUND: "Projet introuvable.",
  DEMO_PROJECT: "Les projets de démonstration ne peuvent pas interroger d'IA.",
  NO_QUERIES: "Saisissez au moins une requête.",
  TOO_MANY_QUERIES: "Trop de requêtes pour un seul lancement.",
  DAILY_LIMIT: "Limite quotidienne de requêtes atteinte. Réessayez demain ou réduisez le nombre de requêtes.",
  ALREADY_RUNNING: "Une mesure est déjà en cours pour ce projet.",
  COST_NOT_ACCEPTED: "Confirmez avoir pris connaissance du coût estimé.",
};

export async function launchAiRunAction(projectId: string, _prev: AiLaunchState, formData: FormData): Promise<AiLaunchState> {
  const user = await requireUser();
  const read = (k: string) => (typeof formData.get(k) === "string" ? (formData.get(k) as string) : "");
  const values = { queries: read("queries"), model: read("model") };
  if (!/^[a-z0-9]{10,40}$/i.test(projectId)) return { error: MESSAGES.NOT_FOUND, values };

  const parsed = parseGeoQueryLines(values.queries);
  if (parsed.errors.length) return { error: parsed.errors.join(" "), values };

  const result = await requestAiRun(user.id, projectId, {
    providerId: read("provider"),
    model: values.model,
    queries: parsed.value,
    costAccepted: read("costAccepted") === "on",
  });
  if (!result.ok) return { error: MESSAGES[result.error], values };
  redirect(`/projects/${projectId}/ai-visibility`);
}
