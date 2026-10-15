import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { OutgoingEmail } from "@/server/email/send";
import type { SiteCrawl } from "@/server/crawler";
import { processAudit } from "@/server/jobs/process-audit";
import { claimNextAudit } from "@/server/jobs/queue";
import { requestAudit } from "@/server/services/audits";
import { createProject } from "@/server/services/projects";
import { analysisFromHtml, fixture, SITE_URL } from "../helpers/scoring-fixtures";
import { createUser, projectInput } from "./factories";

const input = projectInput({
  companyName: "Cabinet Clair",
  siteUrl: SITE_URL,
  domain: "www.cabinet-clair.com",
  sector: "Conseil data",
  primaryTarget: "Dirigeants de PME",
});

async function claimedAudit() {
  const user = await createUser();
  const project = await createProject(user.id, input);
  const request = await requestAudit(user.id, project.id);
  if (!request.ok) throw new Error("échec inattendu");
  expect(await claimNextAudit()).toBe(request.auditId);
  return request.auditId;
}

// Exploration simulée à partir de HTML de test : aucune requête réseau.
const page = (title: string) => `<html><head><title>${title}</title></head><body><h1>${title}</h1><h2>Section</h2></body></html>`;
const fakeCrawl: SiteCrawl = {
  pages: [
    { role: "home", url: SITE_URL, ok: true, analysis: analysisFromHtml(fixture("weak-conversion")) },
    { role: "contact", url: `${SITE_URL}contact`, ok: true, analysis: analysisFromHtml(`${page("Contact")}<form><input type="email" name="email"></form>`, `${SITE_URL}contact`) },
    { role: "about", url: `${SITE_URL}a-propos`, ok: true, analysis: analysisFromHtml(page("À propos"), `${SITE_URL}a-propos`) },
    { role: "other", url: `${SITE_URL}ancienne-page`, ok: false, error: { code: "HTTP_ERROR", message: "", httpStatus: 404, url: `${SITE_URL}ancienne-page` } },
  ],
  sitemap: { found: true, validXml: true, urlCount: 12, urls: [], sources: [`${SITE_URL}sitemap.xml`] },
  brokenLinks: { checked: 3, broken: [`${SITE_URL}ancienne-page`] },
  skipped: [],
};

describe("processAudit", () => {
  it("explore, note et enregistre toutes les pages, avec progression", async () => {
    const auditId = await claimedAudit();
    const seen: unknown[] = [];
    await processAudit(auditId, {
      crawl: async (_url, options) => {
        await options.onProgress?.({ phase: "pages", pagesDone: 2, pagesTotal: 4 });
        seen.push((await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).progress);
        return fakeCrawl;
      },
    });

    expect(seen).toEqual([{ phase: "pages", pagesDone: 2, pagesTotal: 4 }]);
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, include: { pages: true, findings: true } });
    expect(audit.status).toBe("SUCCEEDED");
    expect(audit.scoreTotal).not.toBeNull();
    expect(audit.pages.map((p) => p.pageType).sort()).toEqual(["about", "contact", "home", "other"]);
    expect(audit.pages.find((p) => p.pageType === "other")).toMatchObject({ fetchError: "HTTP_ERROR", httpStatus: 404 });

    const report = audit.reportSnapshot as { pillars: Record<string, { criteria: { code: string; status: string; explanation: string }[] }> };
    const criteria = Object.values(report.pillars).flatMap((p) => p.criteria);
    // Données multi-pages désormais mesurées :
    expect(criteria.find((c) => c.code === "I3")?.status).toBe("PASS"); // sitemap
    expect(criteria.find((c) => c.code === "I12")?.explanation).toMatch(/1 lien cassé sur/);
    expect(criteria.find((c) => c.code === "E2")?.status).toBe("PASS"); // formulaire de la page contact
    expect(audit.progress).toMatchObject({ phase: "done", pagesDone: 4 });
  });

  it("une reprise après arrêt du worker ne duplique pas les résultats", async () => {
    const auditId = await claimedAudit();
    await processAudit(auditId, { crawl: async () => fakeCrawl });
    await prisma.audit.update({ where: { id: auditId }, data: { status: "RUNNING" } });
    await processAudit(auditId, { crawl: async () => fakeCrawl });
    expect(await prisma.pageAnalysis.count({ where: { auditId } })).toBe(4);
  });

  it("prévient l'utilisateur par e-mail avec le score et le lien du rapport", async () => {
    const auditId = await claimedAudit();
    const sent: OutgoingEmail[] = [];
    await processAudit(auditId, {
      crawl: async () => fakeCrawl,
      appUrl: "https://audit.exemple.com/",
      sendEmail: async (email) => {
        sent.push(email);
        return { ok: true };
      },
    });
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, include: { project: { include: { user: true } } } });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(audit.project.user.email);
    expect(sent[0].text).toContain(`https://audit.exemple.com/projects/${audit.projectId}/audits/${auditId}`);
    expect(sent[0].text).toContain(`${audit.scoreTotal} / 100`);
  });

  it("un échec d'envoi de l'e-mail ne change pas le résultat de l'audit", async () => {
    const auditId = await claimedAudit();
    await processAudit(auditId, {
      crawl: async () => fakeCrawl,
      appUrl: "https://audit.exemple.com",
      sendEmail: async () => {
        throw new Error("SMTP indisponible");
      },
    });
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).status).toBe("SUCCEEDED");
  });

  it("erreur imprévue : audit en échec, aucun résultat inventé", async () => {
    const auditId = await claimedAudit();
    const sent: OutgoingEmail[] = [];
    await processAudit(auditId, {
      crawl: async () => {
        throw new Error("panne");
      },
      sendEmail: async (email) => {
        sent.push(email);
        return { ok: true };
      },
    });
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ status: "FAILED", errorCode: "INTERNAL", scoreTotal: null });
    expect(sent).toEqual([]);
  });

  it("projet supprimé pendant l'analyse : aucune exception (le worker continue)", async () => {
    const auditId = await claimedAudit();
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } });
    await expect(
      processAudit(auditId, {
        crawl: async () => {
          await prisma.project.delete({ where: { id: audit.projectId } });
          return fakeCrawl;
        },
      }),
    ).resolves.toBeUndefined();
    expect(await prisma.audit.count({ where: { id: auditId } })).toBe(0);
  });

  it("ignore un audit qui n'est pas en cours (déjà traité ou annulé)", async () => {
    const auditId = await claimedAudit();
    await prisma.audit.update({ where: { id: auditId }, data: { status: "CANCELED" } });
    let called = false;
    await processAudit(auditId, {
      crawl: async () => {
        called = true;
        return fakeCrawl;
      },
    });
    expect(called).toBe(false);
  });
});
