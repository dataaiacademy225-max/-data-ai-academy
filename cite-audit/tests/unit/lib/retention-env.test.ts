import { afterEach, describe, expect, it, vi } from "vitest";
import { getRetentionEnv } from "@/lib/env";

afterEach(() => vi.unstubAllEnvs());

describe("durées de conservation", () => {
  it("par défaut : historique gardé tant que le projet existe (0)", () => {
    vi.stubEnv("AUDIT_RETENTION_DAYS", "");
    vi.stubEnv("AI_RUN_RETENTION_DAYS", "");
    vi.stubEnv("INACTIVE_ACCOUNT_DAYS", "");
    vi.stubEnv("INACTIVE_ACCOUNT_GRACE_DAYS", "");
    expect(getRetentionEnv()).toEqual({ AUDIT_RETENTION_DAYS: 0, AI_RUN_RETENTION_DAYS: 0, INACTIVE_ACCOUNT_DAYS: 1095, INACTIVE_ACCOUNT_GRACE_DAYS: 30 });
  });

  it("accepte une durée et retombe sur la valeur par défaut si la valeur est invalide", () => {
    vi.stubEnv("AUDIT_RETENTION_DAYS", "730");
    vi.stubEnv("AI_RUN_RETENTION_DAYS", "-3");
    expect(getRetentionEnv()).toMatchObject({ AUDIT_RETENTION_DAYS: 730, AI_RUN_RETENTION_DAYS: 0 });
  });

  it("le délai avant suppression d'un compte inactif ne descend jamais sous 14 jours", () => {
    vi.stubEnv("INACTIVE_ACCOUNT_GRACE_DAYS", "3");
    expect(getRetentionEnv().INACTIVE_ACCOUNT_GRACE_DAYS).toBe(30);
  });
});
