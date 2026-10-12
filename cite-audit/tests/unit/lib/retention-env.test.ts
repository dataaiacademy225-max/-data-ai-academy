import { afterEach, describe, expect, it, vi } from "vitest";
import { getRetentionEnv } from "@/lib/env";

afterEach(() => vi.unstubAllEnvs());

describe("durées de conservation", () => {
  it("valeurs par défaut : 2 ans pour les audits, 1 an pour les mesures IA", () => {
    vi.stubEnv("AUDIT_RETENTION_DAYS", "");
    vi.stubEnv("AI_RUN_RETENTION_DAYS", "");
    expect(getRetentionEnv()).toEqual({ AUDIT_RETENTION_DAYS: 730, AI_RUN_RETENTION_DAYS: 365 });
  });

  it("accepte 0 (désactivé) et retombe sur la valeur par défaut si la valeur est invalide", () => {
    vi.stubEnv("AUDIT_RETENTION_DAYS", "0");
    vi.stubEnv("AI_RUN_RETENTION_DAYS", "-3");
    expect(getRetentionEnv()).toEqual({ AUDIT_RETENTION_DAYS: 0, AI_RUN_RETENTION_DAYS: 365 });
  });
});
