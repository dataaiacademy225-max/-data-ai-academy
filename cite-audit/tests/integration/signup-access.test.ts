import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

afterEach(() => vi.unstubAllEnvs());

const signUp = (email: string) =>
  getAuth().api.signUpEmail({ body: { name: "Test", email, password: "mot-de-passe-long" } });

describe("inscriptions sur invitation (bloquées au niveau de Better Auth)", () => {
  it("refuse une adresse non invitée, même en appelant Better Auth directement", async () => {
    vi.stubEnv("SIGNUP_MODE", "invite");
    vi.stubEnv("OWNER_EMAILS", "admin@data-ai-academy.com");
    vi.stubEnv("SIGNUP_ALLOWED_EMAILS", "testeur@exemple-test.com");
    vi.stubEnv("EMAIL_TRANSPORT", "memory");

    await expect(signUp("intrus@exemple-test.com")).rejects.toThrow();
    expect(await prisma.user.count()).toBe(0);

    await signUp("admin@data-ai-academy.com");
    await signUp("testeur@exemple-test.com");
    expect(await prisma.user.count()).toBe(2);
  });

  it("mode ouvert : tout le monde peut s'inscrire", async () => {
    vi.stubEnv("SIGNUP_MODE", "open");
    vi.stubEnv("EMAIL_TRANSPORT", "memory");
    await signUp("quelquun@exemple-test.com");
    expect(await prisma.user.count()).toBe(1);
  });
});
