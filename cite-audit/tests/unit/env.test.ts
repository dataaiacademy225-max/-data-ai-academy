import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getServerEnv", () => {
  it("refuse un secret trop court sans afficher sa valeur", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/db");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("BETTER_AUTH_SECRET", "secret-court");
    const { getServerEnv } = await import("@/lib/env");
    expect(() => getServerEnv()).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => getServerEnv()).not.toThrow(/secret-court/);
  });

  it("accepte une configuration complète", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/db");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
    const { getServerEnv } = await import("@/lib/env");
    expect(getServerEnv().BETTER_AUTH_URL).toBe("http://localhost:3000");
  });
});
