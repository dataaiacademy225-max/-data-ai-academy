"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { getAuth } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { logger } from "@/lib/logger";
import { requireUser } from "@/lib/session";
import { consumeLimit, LIMITS, tooManyAttemptsMessage } from "@/server/services/rate-limit";
import { manualEntryKey, normalizeBackupCode, normalizeTotpCode, totpQrCodeDataUrl } from "@/server/services/two-factor";

export type TwoFactorLoginState = { error?: string; expired?: boolean };

export type TwoFactorSetupState = {
  error?: string;
  /** Étape 2 de l'activation : QR code, clé manuelle et codes de secours à conserver. */
  setup?: { qrCode: string; manualKey: string | null; backupCodes: string[] };
};

export type TwoFactorConfirmState = { error?: string };

export type BackupCodesState = { error?: string; backupCodes?: string[] };

function readString(formData: FormData, key: string, maxLength = 128): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function errorCode(error: unknown): string | undefined {
  if (!isAPIError(error)) return undefined;
  const code = (error.body as { code?: unknown } | undefined)?.code;
  return typeof code === "string" ? code : undefined;
}

/** Connexion, étape 2 : code de l'application (6 chiffres) ou code de secours. */
export async function verifyTwoFactorLoginAction(_prev: TwoFactorLoginState, formData: FormData): Promise<TwoFactorLoginState> {
  const raw = readString(formData, "code", 32);
  const totp = normalizeTotpCode(raw);
  const backup = totp ? null : normalizeBackupCode(raw);
  if (!totp && !backup) {
    return { error: "Saisissez le code à 6 chiffres de votre application, ou un code de secours (10 caractères)." };
  }

  const requestHeaders = await headers();
  const limit = await consumeLimit(`two-factor:ip:${clientIp(requestHeaders)}`, LIMITS.twoFactorPerIp);
  if (!limit.allowed) {
    logger.warn("auth.two_factor_rate_limited", {});
    return { error: tooManyAttemptsMessage(limit.retryAfterMs) };
  }

  try {
    if (totp) await getAuth().api.verifyTOTP({ body: { code: totp }, headers: requestHeaders });
    else await getAuth().api.verifyBackupCode({ body: { code: backup! }, headers: requestHeaders });
  } catch (error) {
    const code = errorCode(error);
    if (code === "INVALID_TWO_FACTOR_COOKIE") {
      return { expired: true, error: "La vérification a expiré (10 minutes). Reconnectez-vous avec votre mot de passe." };
    }
    if (code === "ACCOUNT_TEMPORARILY_LOCKED" || code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE") {
      logger.warn("auth.two_factor_locked", {});
      return { expired: true, error: "Trop de codes incorrects : le compte est bloqué pendant 15 minutes. Réessayez ensuite." };
    }
    if (isAPIError(error)) {
      logger.warn("auth.two_factor_invalid_code", {});
      return { error: totp ? "Code incorrect ou expiré. Saisissez le code affiché en ce moment dans l'application." : "Code de secours incorrect ou déjà utilisé." };
    }
    logger.error("auth.two_factor_failed", { error });
    return { error: "Vérification impossible pour le moment. Réessayez." };
  }
  if (backup) logger.info("auth.two_factor_backup_code_used", {});
  redirect("/dashboard");
}

async function settingsLimit(userId: string): Promise<string | null> {
  const limit = await consumeLimit(`two-factor-settings:user:${userId}`, LIMITS.twoFactorSettingsPerUser);
  if (limit.allowed) return null;
  logger.warn("account.two_factor_settings_rate_limited", { userId });
  return tooManyAttemptsMessage(limit.retryAfterMs);
}

/** Activation, étape 1 : mot de passe → QR code et codes de secours. Rien n'est actif avant l'étape 2. */
export async function startTwoFactorSetupAction(_prev: TwoFactorSetupState, formData: FormData): Promise<TwoFactorSetupState> {
  const user = await requireUser();
  if (user.twoFactorEnabled) return { error: "La double authentification est déjà active." };
  const password = readString(formData, "password");
  if (!password) return { error: "Saisissez votre mot de passe actuel." };
  const limited = await settingsLimit(user.id);
  if (limited) return { error: limited };

  try {
    const result = await getAuth().api.enableTwoFactor({ body: { password }, headers: await headers() });
    if (!("totpURI" in result)) return { error: "Activation impossible pour le moment. Réessayez." };
    return {
      setup: {
        qrCode: await totpQrCodeDataUrl(result.totpURI),
        manualKey: manualEntryKey(result.totpURI),
        backupCodes: result.backupCodes,
      },
    };
  } catch (error) {
    if (isAPIError(error)) return { error: "Mot de passe incorrect." };
    logger.error("account.two_factor_setup_failed", { error, userId: user.id });
    return { error: "Activation impossible pour le moment. Réessayez." };
  }
}

/** Activation, étape 2 : le premier code de l'application prouve que tout est bien configuré. */
export async function confirmTwoFactorSetupAction(_prev: TwoFactorConfirmState, formData: FormData): Promise<TwoFactorConfirmState> {
  const user = await requireUser();
  const code = normalizeTotpCode(readString(formData, "code", 32));
  if (!code) return { error: "Saisissez le code à 6 chiffres affiché dans l'application." };
  const limited = await settingsLimit(user.id);
  if (limited) return { error: limited };

  try {
    await getAuth().api.verifyTOTP({ body: { code }, headers: await headers() });
  } catch (error) {
    if (isAPIError(error)) return { error: "Code incorrect. Vérifiez l'heure de votre téléphone et saisissez le code affiché en ce moment." };
    logger.error("account.two_factor_confirm_failed", { error, userId: user.id });
    return { error: "Vérification impossible pour le moment. Réessayez." };
  }
  logger.info("account.two_factor_enabled", { userId: user.id });
  redirect("/settings/account?double-authentification=activee");
}

/** Désactivation : mot de passe actuel. Un compte propriétaire perd alors ses droits illimités. */
export async function disableTwoFactorAction(_prev: TwoFactorConfirmState, formData: FormData): Promise<TwoFactorConfirmState> {
  const user = await requireUser();
  const password = readString(formData, "password");
  if (!password) return { error: "Saisissez votre mot de passe actuel." };
  const limited = await settingsLimit(user.id);
  if (limited) return { error: limited };

  try {
    await getAuth().api.disableTwoFactor({ body: { password }, headers: await headers() });
  } catch (error) {
    if (isAPIError(error)) return { error: "Mot de passe incorrect : la double authentification reste active." };
    logger.error("account.two_factor_disable_failed", { error, userId: user.id });
    return { error: "Désactivation impossible pour le moment. Réessayez." };
  }
  logger.info("account.two_factor_disabled", { userId: user.id });
  redirect("/settings/account?double-authentification=desactivee");
}

/** Nouveaux codes de secours : les anciens ne fonctionnent plus. */
export async function regenerateBackupCodesAction(_prev: BackupCodesState, formData: FormData): Promise<BackupCodesState> {
  const user = await requireUser();
  const password = readString(formData, "password");
  if (!password) return { error: "Saisissez votre mot de passe actuel." };
  const limited = await settingsLimit(user.id);
  if (limited) return { error: limited };

  try {
    const result = await getAuth().api.generateBackupCodes({ body: { password }, headers: await headers() });
    logger.info("account.two_factor_backup_codes_regenerated", { userId: user.id });
    return { backupCodes: result.backupCodes };
  } catch (error) {
    if (isAPIError(error)) return { error: "Mot de passe incorrect." };
    logger.error("account.two_factor_backup_codes_failed", { error, userId: user.id });
    return { error: "Génération impossible pour le moment. Réessayez." };
  }
}
