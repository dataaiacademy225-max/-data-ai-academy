import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { SiteCrawl } from "@/server/crawler";
import type { OutgoingEmail } from "@/server/email/send";
import { processAudit } from "@/server/jobs/process-audit";
import { claimNextAudit } from "@/server/jobs/queue";
import { getScoreHistory, listAudits, requestAudit } from "@/server/services/audits";
import { getComparison, requestComparison } from "@/server/services/comparisons";
import { createProject } from "@/server/services/projects";
import { purgeExpiredData } from "@/server/services/retention";
import { analysisFromHtml, fixture, SITE_URL } from "../helpers/scoring-fixtures";
import { createUser, projectInput } from "./factories";

const competitors = [
  { name: "Sans site" },
  { name: "Rival 1", url: "https://www.rival-1.com/" },
  { name: "Rival 2", url: "https://www.rival-2.com/" },
  { name: "Rival 3", url: "https://www.rival-3.com/" },
  { name: "Rival 4", url: "https://www.rival-4.com/" },
];

async function setup(overrides = {}) {
  const user = await createUser();
  const project = await createProject(user.id, projectInput({ siteUrl: SITE_URL, competitors, ...overrides }));
  return { user, project };
}

const crawlOf = (html: string): SiteCrawl => ({
  pages: [{ role: "home", url: SITE_URL, ok: true, analysis: analysisFromHtml(html) }],
  sitemap: null,
  brokenLinks: null,
  skipped: [],
});

describe("comparaison avec les concurrents", () => {
  it("audite les 3 premiers concurrents ayant un site, avec les informations de marché du projet", async () => {
    const { user, project } = await setup();
    const result = await requestComparison(user.id, project.id);
    expect(result.ok).toBe(true);
    const audits = await prisma.audit.findMany({ where: { projectId: project.id }, orderBy: { competitorName: "asc" } });
    expect(audits.map((a) => a.competitorName)).toEqual(["Rival 1", "Rival 2", "Rival 3"]);
    expect(audits[0].inputSnapshot).toMatchObject({ siteUrl: "https://www.rival-1.com/", companyName: "Rival 1", sector: project.sector, city: project.city });
    // Une seule comparaison à la fois, mais l'audit du site du projet reste possible.
    expect(await requestComparison(user.id, project.id)).toEqual({ ok: false, error: "ALREADY_RUNNING" });
    expect((await requestAudit(user.id, project.id)).ok).toBe(true);
  });

  it("refuse sans concurrent ayant un site, sur un projet d'autrui ou au-delà de la limite du jour", async () => {
    const { user, project } = await setup({ competitors: [{ name: "Sans site" }] });
    expect(await requestComparison(user.id, project.id)).toEqual({ ok: false, error: "NO_COMPETITOR_URL" });
    const other = await createUser();
    expect(await requestComparison(other.id, project.id)).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(await getComparison(other.id, project.id)).toBeNull();

    const full = await setup();
    expect(await requestComparison(full.user.id, full.project.id, { dailyLimit: 2 })).toEqual({ ok: false, error: "QUOTA" });
    expect(await prisma.audit.count({ where: { projectId: full.project.id } })).toBe(0);
  });

  it("les audits de concurrents restent hors de l'historique ; un seul e-mail quand tout est terminé", async () => {
    const { user, project } = await setup({ competitors: competitors.slice(0, 3) });
    const own = await requestAudit(user.id, project.id);
    if (!own.ok) throw new Error("échec inattendu");
    expect(await claimNextAudit()).toBe(own.auditId);
    await processAudit(own.auditId, { crawl: async () => crawlOf(fixture("weak-conversion")), sendEmail: async () => ({ ok: true }), appUrl: "https://app.test" });

    expect((await requestComparison(user.id, project.id)).ok).toBe(true);
    const sent: OutgoingEmail[] = [];
    const deps = {
      appUrl: "https://app.test",
      sendEmail: async (email: OutgoingEmail) => {
        sent.push(email);
        return { ok: true };
      },
    };
    const first = await claimNextAudit();
    await processAudit(first!, { ...deps, crawl: async () => crawlOf(fixture("weak-conversion")) });
    expect(sent).toHaveLength(0);
    const second = await claimNextAudit();
    await processAudit(second!, { ...deps, crawl: async () => Promise.reject(new Error("site injoignable")) });

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("Comparaison prête");
    expect(sent[0].text).toContain(`https://app.test/projects/${project.id}/comparaison`);
    expect(sent[0].text).toContain("1 site analysé sur 2");

    expect((await listAudits(user.id, project.id)).map((a) => a.id)).toEqual([own.auditId]);
    expect((await getScoreHistory(user.id)).map((a) => a.id)).toEqual([own.auditId]);

    const data = await getComparison(user.id, project.id);
    expect(data?.pending).toBe(false);
    expect(data?.view.sites.map((s) => [s.name, s.state])).toEqual([
      [project.companyName, "DONE"],
      ["Rival 1", "DONE"],
      ["Rival 2", "FAILED"],
    ]);
    expect(data?.view.comparedCompetitors).toBe(1);
  });

  it("la purge garde le dernier audit du site et la dernière comparaison", async () => {
    const { user, project } = await setup();
    const now = new Date("2030-01-01T00:00:00Z");
    const old = new Date("2026-01-01T00:00:00Z");
    const own = await prisma.audit.create({ data: { projectId: project.id, queuedAt: old, status: "SUCCEEDED", scoringVersion: "test", inputSnapshot: {} } });
    for (const createdAt of [old, new Date("2026-02-01T00:00:00Z")]) {
      const c = await prisma.comparison.create({ data: { projectId: project.id, createdAt } });
      // Audit de concurrent plus récent que l'audit du site : il ne doit pas le faire supprimer.
      await prisma.audit.create({
        data: { projectId: project.id, comparisonId: c.id, queuedAt: createdAt, status: "SUCCEEDED", scoringVersion: "test", inputSnapshot: {} },
      });
    }
    void user;
    const report = await purgeExpiredData({ AUDIT_RETENTION_DAYS: 30, AI_RUN_RETENTION_DAYS: 0 }, now);
    expect(report).toMatchObject({ audits: 0, comparisons: 1 });
    expect(await prisma.audit.findUnique({ where: { id: own.id } })).not.toBeNull();
    expect(await prisma.comparison.count()).toBe(1);
    expect(await prisma.audit.count()).toBe(2);
  });
});
