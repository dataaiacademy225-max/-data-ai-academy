import "server-only";
import QRCode from "qrcode";

/**
 * Outils de la double authentification (fonctions pures, sans base de données).
 * Le secret et les codes de secours sont gérés et chiffrés par Better Auth (plugin « two-factor »).
 */

/** Code donné par l'application d'authentification : exactement 6 chiffres (espaces ignorés). */
export function normalizeTotpCode(input: string): string | null {
  const code = input.replace(/\s+/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

/** Code de secours au format Better Auth : 10 caractères, avec ou sans tiret au milieu (« abcde-12345 »). */
export function normalizeBackupCode(input: string): string | null {
  const compact = input.replace(/[\s-]+/g, "");
  return /^[A-Za-z0-9]{10}$/.test(compact) ? `${compact.slice(0, 5)}-${compact.slice(5)}` : null;
}

/** Clé à saisir à la main dans l'application si le QR code ne peut pas être scanné (groupes de 4 caractères). */
export function manualEntryKey(totpUri: string): string | null {
  let secret: string | null = null;
  try {
    secret = new URL(totpUri).searchParams.get("secret");
  } catch {
    return null;
  }
  if (!secret || !/^[A-Z2-7]+=*$/i.test(secret)) return null;
  return secret.replace(/=+$/, "").toUpperCase().match(/.{1,4}/g)!.join(" ");
}

/** QR code de l'URI otpauth://, en image PNG intégrée (data:), générée sur le serveur : aucun service externe. */
export async function totpQrCodeDataUrl(totpUri: string): Promise<string> {
  return QRCode.toDataURL(totpUri, { errorCorrectionLevel: "M", margin: 1, width: 220 });
}
