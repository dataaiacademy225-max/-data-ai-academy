import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { hasPlaceholders, LEGAL_ENTITY, legalPages } from "@/content/legal";
import { getRetentionEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function Page() {
  const retention = getRetentionEnv();
  const page = legalPages({
    auditRetentionDays: retention.AUDIT_RETENTION_DAYS,
    aiRunRetentionDays: retention.AI_RUN_RETENTION_DAYS,
  })["confidentialite"];
  return <LegalDocument page={page} updatedAt={LEGAL_ENTITY.updatedAt} draft={hasPlaceholders()} />;
}
