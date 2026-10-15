import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { OutgoingEmail } from "@/server/email/send";
import { purgeAccessRequests, submitAccessRequest } from "@/server/services/access-requests";

const input = { name: "Awa Koné", email: "awa@exemple-test.com", company: "Cabinet Awa", siteUrl: "https://cabinet-awa.ci/", message: null };

function deps(sent: OutgoingEmail[], now = new Date("2026-10-15T10:00:00Z")) {
  return {
    now,
    appUrl: "https://audit.exemple.com",
    ownerEmails: ["proprio@exemple-test.com"],
    sendEmail: async (email: OutgoingEmail) => {
      sent.push(email);
      return { ok: true };
    },
  };
}

describe("demandes d'accès", () => {
  it("enregistre la demande et prévient seulement le propriétaire", async () => {
    const sent: OutgoingEmail[] = [];
    expect(await submitAccessRequest(input, "203.0.113.1", deps(sent))).toEqual({ ok: true });
    expect(await prisma.accessRequest.count()).toBe(1);
    expect(sent.map((e) => e.to)).toEqual(["proprio@exemple-test.com"]);
    expect(sent[0].text).toContain("https://audit.exemple.com/settings/demandes-acces");
  });

  it("ne duplique pas une demande renvoyée dans les 24 h, sans le révéler", async () => {
    const sent: OutgoingEmail[] = [];
    await submitAccessRequest(input, "203.0.113.1", deps(sent));
    expect(await submitAccessRequest(input, "203.0.113.2", deps(sent))).toEqual({ ok: true });
    expect(await prisma.accessRequest.count()).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it("limite les envois depuis une même adresse IP", async () => {
    const sent: OutgoingEmail[] = [];
    for (let i = 0; i < 5; i++) {
      expect((await submitAccessRequest({ ...input, email: `p${i}@exemple-test.com` }, "203.0.113.9", deps(sent))).ok).toBe(true);
    }
    const blocked = await submitAccessRequest({ ...input, email: "p9@exemple-test.com" }, "203.0.113.9", deps(sent));
    expect(blocked.ok).toBe(false);
    expect(await prisma.accessRequest.count()).toBe(5);
  });

  it("supprime les demandes de plus de 12 mois", async () => {
    await prisma.accessRequest.create({ data: { ...input, createdAt: new Date("2025-09-01T00:00:00Z") } });
    await prisma.accessRequest.create({ data: { ...input, email: "recent@exemple-test.com", createdAt: new Date("2026-10-01T00:00:00Z") } });
    expect(await purgeAccessRequests(new Date("2026-10-15T00:00:00Z"))).toBe(1);
    expect((await prisma.accessRequest.findMany()).map((r) => r.email)).toEqual(["recent@exemple-test.com"]);
  });
});
