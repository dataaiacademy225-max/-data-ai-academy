import { Prisma } from "@/generated/prisma/client";
import type { PageInput, ScoringResult } from "@/server/scoring/types";

/**
 * Traduction d'un résultat de scoring en lignes de base de données.
 * Sans dépendance au réseau ni à Next.js : utilisé par le service d'audit et par le seed de démonstration.
 */

type Tx = Prisma.TransactionClient;

const json = (value: unknown) => value as Prisma.InputJsonValue;

export async function saveAuditResult(
  tx: Tx,
  auditId: string,
  pages: PageInput[],
  result: ScoringResult,
  options: { textPrefix?: string } = {},
) {
  const prefix = options.textPrefix ?? "";

  await tx.pageAnalysis.createMany({
    data: pages.map((page) =>
      page.ok
        ? {
            auditId,
            requestedUrl: page.analysis.requestedUrl,
            finalUrl: page.analysis.finalUrl,
            httpStatus: page.analysis.httpStatus,
            redirectChain: json(page.analysis.redirectChain),
            pageType: page.role,
            robotsAllowed: true,
            bytes: page.analysis.bytes,
            fetchMs: page.analysis.fetchMs,
            facts: json(page.analysis.facts),
          }
        : {
            auditId,
            requestedUrl: page.url,
            httpStatus: page.error.httpStatus ?? null,
            pageType: page.role,
            robotsAllowed: page.error.code !== "ROBOTS_DISALLOWED",
            fetchError: page.error.code,
          },
    ),
  });

  if (result.recommendations.length > 0) {
    await tx.finding.createMany({
      data: result.recommendations.map((r) => ({
        auditId,
        pillar: r.pillar,
        criterionCode: r.criterionCode,
        priority: r.priority,
        observation: `${prefix}${r.observation}`,
        evidence: json(r.evidence),
        impact: r.impact,
        recommendation: r.recommendation,
        effort: r.effort,
      })),
    });
  }

  await tx.audit.update({
    where: { id: auditId },
    data: {
      // PARTIAL : l'audit s'est déroulé mais les données ne permettent pas de noter le site.
      status: result.scoreTotal === null ? "PARTIAL" : "SUCCEEDED",
      finishedAt: new Date(),
      scoringVersion: result.scoringVersion,
      scoreTotal: result.scoreTotal,
      scoreClarifier: result.pillars.CLARIFIER.score,
      scoreIndexer: result.pillars.INDEXER.score,
      scoreTunnel: result.pillars.TUNNEL.score,
      scoreEnclencher: result.pillars.ENCLENCHER.score,
      coverage: result.coverage,
      reportSnapshot: json(result),
    },
  });
}
