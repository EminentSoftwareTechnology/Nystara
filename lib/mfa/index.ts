import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { decryptSecret, encryptSecret } from "./crypto";
import { authenticationOptions, registerPasskey, registrationOptions, verifyPasskey } from "./passkeys";
import { consumeRecoveryCode, looksLikeRecoveryCode, regenerateRecoveryCodes } from "./recovery";
import { type Proof, proofSchema, registrationResponse } from "./schemas";
import { newTotpSecret, totpEnrollment, verifyTotp } from "./totp";

export type MfaMethods = { totp: boolean; passkey: boolean };

export async function mfaMethods(userId: string): Promise<MfaMethods> {
  const [user, passkeys] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { totpEnabledAt: true } }),
    prisma.passkey.count({ where: { userId } }),
  ]);
  return { totp: Boolean(user?.totpEnabledAt), passkey: passkeys > 0 };
}

async function refreshMfaFlag(userId: string): Promise<boolean> {
  const { totp, passkey } = await mfaMethods(userId);
  const enabled = totp || passkey;
  await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: enabled } });
  if (!enabled) await prisma.recoveryCode.deleteMany({ where: { userId } });
  return enabled;
}

/** Null when the secret can't be decrypted, e.g. after MFA_ENCRYPTION_KEY was rotated; other factors still work. */
function openSecret(sealed: string, userId: string): string | null {
  try {
    return decryptSecret(sealed, userId);
  } catch {
    return null;
  }
}

async function verifyCode(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabledAt: true, totpLastStep: true },
  });
  if (user?.totpSecret && user.totpEnabledAt && /^\d{6}$/.test(code)) {
    const secret = openSecret(user.totpSecret, userId);
    const step = secret ? verifyTotp(secret, code, user.totpLastStep) : null;
    if (step === null) return false;
    // Conditional update so two concurrent requests can't both spend the same code.
    const { count } = await prisma.user.updateMany({
      where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return count === 1;
  }
  return looksLikeRecoveryCode(code) && consumeRecoveryCode(userId, code);
}

/** Checks a second factor for `userId`. Attempts are limited per account on top of the per-IP limits. */
export async function verifyFactor(userId: string, proof: Proof): Promise<boolean> {
  const limit = await rateLimit(`mfa:${userId}`, 10, 15 * 60_000);
  if (!limit.ok) return false;
  const ok = proof.type === "code" ? await verifyCode(userId, proof.code) : (await verifyPasskey(proof.response, userId)) === userId;
  audit("mfa_verify", ok ? "success" : "denied");
  return ok;
}

export async function securityStatus(userId: string) {
  const [user, passkeys, recoveryRemaining] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { totpEnabledAt: true } }),
    prisma.passkey.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, createdAt: true, lastUsedAt: true, backedUp: true },
    }),
    prisma.recoveryCode.count({ where: { userId, usedAt: null } }),
  ]);
  return {
    totpEnabled: Boolean(user?.totpEnabledAt),
    passkeys,
    recoveryRemaining,
    mfaEnabled: Boolean(user?.totpEnabledAt) || passkeys.length > 0,
  };
}

const bodySchemas = {
  "totp-setup": z.object({}),
  "totp-enable": z.object({ code: z.string().regex(/^\d{6}$/), proof: proofSchema.optional() }),
  "totp-disable": z.object({ proof: proofSchema }),
  "passkey-options": z.object({}),
  "passkey-register": z.object({
    name: z.string().trim().min(1).max(60),
    response: registrationResponse,
    proof: proofSchema.optional(),
  }),
  "passkey-delete": z.object({ id: z.string().min(1).max(64), proof: proofSchema }),
  "recovery-regenerate": z.object({ proof: proofSchema }),
  "proof-options": z.object({}),
} as const;

export type SecurityAction = keyof typeof bodySchemas;

export function isSecurityAction(value: string): value is SecurityAction {
  return Object.hasOwn(bodySchemas, value);
}

type Result = { status: number; body: Record<string, unknown>; verified?: boolean };
const PROOF_REQUIRED: Result = { status: 403, body: { error: "Confirm with your current second factor", proofRequired: true } };
const PROOF_FAILED: Result = { status: 403, body: { error: "That code or passkey wasn’t accepted", proofRequired: true } };

/**
 * One implementation of the security settings API for readers and admins. Once a user has any second factor,
 * every change to their factors needs a fresh proof, so a stolen session alone can't add or remove one.
 * `verified: true` tells the caller the user just completed a second factor for this session.
 */
export async function handleSecurityAction(
  action: SecurityAction,
  user: { id: string; email: string; name: string | null },
  rawBody: unknown,
): Promise<Result> {
  const parsed = bodySchemas[action].safeParse(rawBody ?? {});
  if (!parsed.success) return { status: 400, body: { error: "Invalid input" } };
  const userId = user.id;
  const methods = await mfaMethods(userId);
  const hasMfa = methods.totp || methods.passkey;

  async function proven(proof: Proof | undefined): Promise<Result | null> {
    if (!proof) return PROOF_REQUIRED;
    return (await verifyFactor(userId, proof)) ? null : PROOF_FAILED;
  }

  switch (action) {
    case "proof-options":
      return { status: 200, body: { options: methods.passkey ? await authenticationOptions(userId) : null, methods } };

    case "totp-setup": {
      if (methods.totp) return { status: 409, body: { error: "Authenticator app is already on" } };
      const secret = newTotpSecret();
      await prisma.user.update({ where: { id: userId }, data: { totpSecret: encryptSecret(secret, userId), totpLastStep: null } });
      return { status: 200, body: await totpEnrollment(secret, user.email) };
    }

    case "totp-enable": {
      const { code, proof } = bodySchemas[action].parse(rawBody);
      if (methods.totp) return { status: 409, body: { error: "Authenticator app is already on" } };
      if (hasMfa) {
        const denied = await proven(proof);
        if (denied) return denied;
      }
      const pending = await prisma.user.findUnique({ where: { id: userId }, select: { totpSecret: true } });
      const secret = pending?.totpSecret ? openSecret(pending.totpSecret, userId) : null;
      const step = secret ? verifyTotp(secret, code, null) : null;
      if (step === null) return { status: 400, body: { error: "That code didn’t match. Check your device’s clock and try again." } };
      await prisma.user.update({ where: { id: userId }, data: { totpEnabledAt: new Date(), totpLastStep: step } });
      await refreshMfaFlag(userId);
      const recoveryCodes = hasMfa ? undefined : await regenerateRecoveryCodes(userId);
      audit("mfa_totp_enabled", "success");
      return { status: 200, body: { ok: true, recoveryCodes }, verified: true };
    }

    case "totp-disable": {
      const denied = await proven(bodySchemas[action].parse(rawBody).proof);
      if (denied) return denied;
      await prisma.user.update({ where: { id: userId }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null } });
      await refreshMfaFlag(userId);
      audit("mfa_totp_disabled", "success");
      return { status: 200, body: { ok: true } };
    }

    case "passkey-options": {
      const options = await registrationOptions(user);
      return { status: 200, body: { options } };
    }

    case "passkey-register": {
      const { name, response, proof } = bodySchemas[action].parse(rawBody);
      if (hasMfa) {
        const denied = await proven(proof);
        if (denied) return denied;
      }
      const created = await registerPasskey(userId, response, name);
      if (!created) return { status: 400, body: { error: "The passkey couldn’t be verified. Please try again." } };
      await refreshMfaFlag(userId);
      const recoveryCodes = hasMfa ? undefined : await regenerateRecoveryCodes(userId);
      audit("mfa_passkey_added", "success");
      return { status: 200, body: { ok: true, recoveryCodes }, verified: true };
    }

    case "passkey-delete": {
      const { id, proof } = bodySchemas[action].parse(rawBody);
      const denied = await proven(proof);
      if (denied) return denied;
      const { count } = await prisma.passkey.deleteMany({ where: { id, userId } });
      if (count === 0) return { status: 404, body: { error: "Passkey not found" } };
      await refreshMfaFlag(userId);
      audit("mfa_passkey_removed", "success");
      return { status: 200, body: { ok: true } };
    }

    case "recovery-regenerate": {
      if (!hasMfa) return { status: 409, body: { error: "Turn on a second factor first" } };
      const denied = await proven(bodySchemas[action].parse(rawBody).proof);
      if (denied) return denied;
      audit("mfa_recovery_regenerated", "success");
      return { status: 200, body: { ok: true, recoveryCodes: await regenerateRecoveryCodes(userId) } };
    }
  }
}
