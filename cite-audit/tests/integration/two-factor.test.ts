import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { totpFromUri } from "../helpers/totp";

const EMAIL = "awa@exemple-test.com";
const PASSWORD = "mot-de-passe-long";

beforeEach(() => vi.stubEnv("EMAIL_TRANSPORT", "memory"));
afterEach(() => vi.unstubAllEnvs());

/** En-tête Cookie à partir des Set-Cookie d'une réponse (simule le navigateur). */
function cookieHeader(headers: Headers): Headers {
  const cookies = headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("="));
  return new Headers({ cookie: cookies.join("; ") });
}

async function signUpAndSignIn(): Promise<Headers> {
  await getAuth().api.signUpEmail({ body: { name: "Awa", email: EMAIL, password: PASSWORD } });
  const { headers } = await getAuth().api.signInEmail({ body: { email: EMAIL, password: PASSWORD }, returnHeaders: true });
  return cookieHeader(headers);
}

/** Active la double authentification comme le ferait l'utilisateur : mot de passe, puis premier code. */
async function enable(session: Headers) {
  const setup = await getAuth().api.enableTwoFactor({ body: { password: PASSWORD }, headers: session });
  if (!("totpURI" in setup)) throw new Error("TOTP attendu");
  return setup;
}

describe("double authentification (TOTP)", () => {
  it("n'est active qu'après la saisie d'un premier code valide", async () => {
    const session = await signUpAndSignIn();
    const setup = await enable(session);
    expect(setup.backupCodes).toHaveLength(10);
    expect((await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).twoFactorEnabled).toBe(false);

    await expect(getAuth().api.verifyTOTP({ body: { code: "000000" }, headers: session })).rejects.toThrow();
    await getAuth().api.verifyTOTP({ body: { code: totpFromUri(setup.totpURI) }, headers: session });
    expect((await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).twoFactorEnabled).toBe(true);
  });

  it("stocke le secret et les codes de secours chiffrés, jamais en clair", async () => {
    const setup = await enable(await signUpAndSignIn());
    const row = await prisma.twoFactor.findFirstOrThrow();
    const secret = new URL(setup.totpURI).searchParams.get("secret")!;
    expect(row.secret).not.toContain(secret);
    for (const code of setup.backupCodes) expect(row.backupCodes).not.toContain(code);
  });

  it("à la connexion, le mot de passe seul n'ouvre aucune session : le code est exigé", async () => {
    const session = await signUpAndSignIn();
    const setup = await enable(session);
    await getAuth().api.verifyTOTP({ body: { code: totpFromUri(setup.totpURI) }, headers: session });
    await prisma.session.deleteMany();

    const { headers, response } = await getAuth().api.signInEmail({ body: { email: EMAIL, password: PASSWORD }, returnHeaders: true });
    expect(response).toMatchObject({ twoFactorRedirect: true });
    expect(await prisma.session.count()).toBe(0);
    const pending = cookieHeader(headers);
    expect(await getAuth().api.getSession({ headers: pending })).toBeNull();

    await expect(getAuth().api.verifyTOTP({ body: { code: "000000" }, headers: pending })).rejects.toThrow();
    expect(await prisma.session.count()).toBe(0);

    await getAuth().api.verifyTOTP({ body: { code: totpFromUri(setup.totpURI) }, headers: pending });
    expect(await prisma.session.count()).toBe(1);
  });

  it("un code de secours remplace le code de l'application, une seule fois", async () => {
    const session = await signUpAndSignIn();
    const setup = await enable(session);
    await getAuth().api.verifyTOTP({ body: { code: totpFromUri(setup.totpURI) }, headers: session });
    const [backupCode] = setup.backupCodes;

    const first = await getAuth().api.signInEmail({ body: { email: EMAIL, password: PASSWORD }, returnHeaders: true });
    await getAuth().api.verifyBackupCode({ body: { code: backupCode }, headers: cookieHeader(first.headers) });

    const second = await getAuth().api.signInEmail({ body: { email: EMAIL, password: PASSWORD }, returnHeaders: true });
    await expect(getAuth().api.verifyBackupCode({ body: { code: backupCode }, headers: cookieHeader(second.headers) })).rejects.toThrow();
  });

  it("désactivation : mot de passe exigé, puis connexion sans code", async () => {
    const session = await signUpAndSignIn();
    const setup = await enable(session);
    const { headers } = await getAuth().api.verifyTOTP({ body: { code: totpFromUri(setup.totpURI) }, headers: session, returnHeaders: true });
    const enabledSession = cookieHeader(headers);

    await expect(getAuth().api.disableTwoFactor({ body: { password: "mauvais-mot-de-passe" }, headers: enabledSession })).rejects.toThrow();
    await getAuth().api.disableTwoFactor({ body: { password: PASSWORD }, headers: enabledSession });
    expect((await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).twoFactorEnabled).toBe(false);

    const result = await getAuth().api.signInEmail({ body: { email: EMAIL, password: PASSWORD } });
    expect("twoFactorRedirect" in result).toBe(false);
  });

  it("supprime les données de double authentification avec le compte", async () => {
    await enable(await signUpAndSignIn());
    expect(await prisma.twoFactor.count()).toBe(1);
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    expect(await prisma.twoFactor.count()).toBe(0);
  });
});
