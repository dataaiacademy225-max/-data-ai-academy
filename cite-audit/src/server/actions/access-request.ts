"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { isOwner } from "@/lib/access";
import { clientIp } from "@/lib/client-ip";
import { getAccessEnv, getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { requireUser } from "@/lib/session";
import { accessRequestSchema } from "@/lib/validation/access-request";
import { sendEmail } from "@/server/email/send";
import { setAccessRequestHandled, submitAccessRequest } from "@/server/services/access-requests";

export type AccessRequestFormState = {
  sent?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

const FIELDS = ["name", "email", "company", "siteUrl", "message", "interest", "source", "campaign"] as const;

export async function requestAccessAction(_prev: AccessRequestFormState, formData: FormData): Promise<AccessRequestFormState> {
  const read = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const values = Object.fromEntries(FIELDS.map((key) => [key, read(key)]));

  // Champ piège invisible : seul un robot le remplit. Réponse identique, rien n'est enregistré.
  if (read("fax") !== "") return { sent: true };

  const parsed = accessRequestSchema.safeParse({ ...values, consent: read("consent") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };

  const { consent, ...input } = parsed.data;
  void consent;
  try {
    const result = await submitAccessRequest(input, clientIp(await headers()), {
      sendEmail,
      appUrl: getServerEnv().BETTER_AUTH_URL,
      ownerEmails: getAccessEnv().OWNER_EMAILS,
    });
    return result.ok ? { sent: true } : { error: result.error, values };
  } catch (error) {
    logger.error("access_request.failed", { error });
    return { error: "Envoi impossible pour le moment. Réessayez dans quelques minutes.", values };
  }
}

/** Marque une demande comme traitée (ou non). Réservé au propriétaire, vérifié côté serveur. */
export async function setAccessRequestHandledAction(id: string, handled: boolean): Promise<void> {
  const user = await requireUser();
  if (!isOwner(user)) return;
  await setAccessRequestHandled(id, handled);
  revalidatePath("/settings/demandes-acces");
}
