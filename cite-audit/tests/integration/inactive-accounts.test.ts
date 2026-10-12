import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { OutgoingEmail } from "@/server/email/send";
import { markUserActive, processInactiveAccounts } from "@/server/services/inactive-accounts";
import { createProject } from "@/server/services/projects";
import { createUser, projectInput } from "./factories";

const DAY = 86_400_000;
const now = new Date("2030-01-01T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY);
const config = { inactiveDays: 1095, graceDays: 30 };

function mailer(ok = true) {
  const sent: OutgoingEmail[] = [];
  return { sent, sendEmail: async (email: OutgoingEmail) => (sent.push(email), { ok }) };
}

async function userLastActive(days: number, warnedDaysAgo?: number) {
  const user = await createUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: daysAgo(days), inactivityWarnedAt: warnedDaysAgo === undefined ? null : daysAgo(warnedDaysAgo) },
  });
  return user;
}

const run = (m: ReturnType<typeof mailer>, at = now) =>
  processInactiveAccounts(config, { sendEmail: m.sendEmail, appUrl: "https://app.exemple.com", now: at });

describe("comptes inactifs", () => {
  it("avertit après 3 ans sans connexion, une seule fois, sans rien supprimer", async () => {
    const inactive = await userLastActive(1096);
    const active = await userLastActive(1000);
    const m = mailer();

    expect(await run(m)).toEqual({ warned: 1, warningFailed: 0, deleted: 0 });
    expect(m.sent).toHaveLength(1);
    expect(m.sent[0].to).toBe(inactive.email);
    expect(m.sent[0].text).toContain("31 janvier 2030");
    expect(m.sent[0].text).toContain("https://app.exemple.com/login");
    expect((await prisma.user.findUnique({ where: { id: active.id } }))?.inactivityWarnedAt).toBeNull();

    expect((await run(m, new Date(now.getTime() + DAY))).warned).toBe(0);
    expect(m.sent).toHaveLength(1);
    expect(await prisma.user.count()).toBe(2);
  });

  it("supprime le compte et toutes ses données 30 jours après l'avertissement", async () => {
    const user = await userLastActive(1200, 31);
    const project = await createProject(user.id, projectInput());
    await prisma.audit.create({ data: { projectId: project.id, scoringVersion: "t", inputSnapshot: {}, status: "SUCCEEDED" } });

    expect((await run(mailer())).deleted).toBe(1);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.project.count()).toBe(0);
    expect(await prisma.audit.count()).toBe(0);
  });

  it("n'efface pas avant la fin du délai de 30 jours", async () => {
    await userLastActive(1200, 29);
    expect((await run(mailer())).deleted).toBe(0);
    expect(await prisma.user.count()).toBe(1);
  });

  it("une reconnexion après l'avertissement annule la suppression", async () => {
    const user = await userLastActive(1200, 40);
    await markUserActive(user.id, daysAgo(5));
    expect(await run(mailer())).toEqual({ warned: 0, warningFailed: 0, deleted: 0 });
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.inactivityWarnedAt).toBeNull();
  });

  it("si l'e-mail n'a pas pu partir, le compte n'est ni marqué averti ni supprimé", async () => {
    const user = await userLastActive(2000);
    const failing = mailer(false);
    expect(await run(failing)).toEqual({ warned: 0, warningFailed: 1, deleted: 0 });
    expect(await run(failing, new Date(now.getTime() + 60 * DAY))).toMatchObject({ deleted: 0 });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("ne touche jamais au compte de démonstration", async () => {
    const demoUser = await userLastActive(3000, 100);
    await prisma.project.create({
      data: { ...projectInput({ companyName: "[DÉMO] P" }), userId: demoUser.id, isDemo: true, ownershipAttestedAt: now },
    });
    const m = mailer();
    expect(await run(m)).toEqual({ warned: 0, warningFailed: 0, deleted: 0 });
    expect(m.sent).toHaveLength(0);
  });

  it("0 désactive la règle", async () => {
    await userLastActive(5000, 500);
    const r = await processInactiveAccounts({ inactiveDays: 0, graceDays: 30 }, { sendEmail: mailer().sendEmail, appUrl: "x", now });
    expect(r).toEqual({ warned: 0, warningFailed: 0, deleted: 0 });
  });

  it("une connexion réelle met à jour la dernière activité", async () => {
    // Passe par Better Auth : vérifie le crochet posé sur la création de session.
    const { getAuth } = await import("@/lib/auth");
    const email = `actif-${randomUUID()}@exemple-test.com`;
    await getAuth().api.signUpEmail({ body: { name: "A", email, password: "mot-de-passe-long" } });
    await prisma.user.update({ where: { email }, data: { lastActiveAt: daysAgo(2000), inactivityWarnedAt: daysAgo(10) } });
    await getAuth().api.signInEmail({ body: { email, password: "mot-de-passe-long" } });
    const after = await prisma.user.findUnique({ where: { email } });
    expect(after?.inactivityWarnedAt).toBeNull();
    expect(Date.now() - (after?.lastActiveAt.getTime() ?? 0)).toBeLessThan(60_000);
  });
});
