import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { manualEntryKey, normalizeBackupCode, normalizeTotpCode, totpQrCodeDataUrl } from "@/server/services/two-factor";
import { findForbiddenWording } from "@/server/scoring/wording-guard";

describe("outils de double authentification", () => {
  it("reconnaît un code d'application : 6 chiffres, espaces ignorés", () => {
    expect(normalizeTotpCode("123456")).toBe("123456");
    expect(normalizeTotpCode(" 123 456 ")).toBe("123456");
    expect(normalizeTotpCode("12345")).toBeNull();
    expect(normalizeTotpCode("12345a")).toBeNull();
    expect(normalizeTotpCode("abcde-12345")).toBeNull();
  });

  it("reconnaît un code de secours, avec ou sans tiret", () => {
    expect(normalizeBackupCode("abCde-12345")).toBe("abCde-12345");
    expect(normalizeBackupCode("abCde12345")).toBe("abCde-12345");
    expect(normalizeBackupCode(" abCde 12345 ")).toBe("abCde-12345");
    expect(normalizeBackupCode("abcde-1234")).toBeNull();
    expect(normalizeBackupCode("abcde-12345<")).toBeNull();
  });

  it("extrait la clé à saisir à la main, par groupes de 4", () => {
    expect(manualEntryKey("otpauth://totp/GriotCite:a%40b.com?secret=jbswy3dpehpk3pxp&issuer=GriotCite")).toBe("JBSW Y3DP EHPK 3PXP");
    expect(manualEntryKey("otpauth://totp/x?issuer=GriotCite")).toBeNull();
    expect(manualEntryKey("otpauth://totp/x?secret=pas-du-base32!")).toBeNull();
    expect(manualEntryKey("pas une adresse")).toBeNull();
  });

  it("produit un QR code PNG intégré, sans service externe", async () => {
    const dataUrl = await totpQrCodeDataUrl("otpauth://totp/GriotCite:a%40b.com?secret=JBSWY3DPEHPK3PXP&issuer=GriotCite");
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("textes affichés : aucune promesse de résultat IA", () => {
    for (const file of [
      "src/server/actions/two-factor.ts",
      "src/components/account/two-factor-settings.tsx",
      "src/components/auth/two-factor-login-form.tsx",
      "src/app/(auth)/login/double-authentification/page.tsx",
      "src/app/(app)/settings/account/page.tsx",
    ]) {
      expect(findForbiddenWording(readFileSync(file, "utf8")), file).toEqual([]);
    }
  });
});
