import {
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";

const CHALLENGE_TTL_MS = 5 * 60_000;
export type ChallengePurpose = "register" | "assert" | "login";

function relyingParty() {
  const url = new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000");
  return { rpID: url.hostname, origin: url.origin, rpName: "Nystara" };
}

async function storeChallenge(challenge: string, purpose: ChallengePurpose, userId: string | null) {
  await prisma.authChallenge.create({
    data: { challenge, purpose, userId, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
  });
}

/** Deletes the challenge as it is checked, so each one verifies at most one response. */
async function consumeChallenge(challenge: string, purpose: ChallengePurpose, userId: string | null) {
  const { count } = await prisma.authChallenge.deleteMany({
    where: { challenge, purpose, userId, expiresAt: { gt: new Date() } },
  });
  return count === 1;
}

export async function registrationOptions(user: { id: string; email: string; name: string | null }) {
  const { rpID, rpName } = relyingParty();
  const existing = await prisma.passkey.findMany({ where: { userId: user.id }, select: { credentialId: true, transports: true } });
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.name ?? user.email,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  await storeChallenge(options.challenge, "register", user.id);
  return options;
}

export async function registerPasskey(userId: string, response: RegistrationResponseJSON, name: string) {
  const { rpID, origin } = relyingParty();
  const { verified, registrationInfo } = await verifyRegistrationResponse({
    response,
    expectedChallenge: (challenge) => consumeChallenge(challenge, "register", userId),
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  }).catch(() => ({ verified: false, registrationInfo: undefined }));
  if (!verified || !registrationInfo) return null;
  const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;
  return prisma.passkey.create({
    data: {
      userId,
      name,
      credentialId: credential.id,
      publicKey: new Uint8Array(credential.publicKey),
      counter: BigInt(credential.counter),
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    },
    select: { id: true },
  });
}

/** Options for a known user (step-up and confirmation) or, without a user, a discoverable sign-in. */
export async function authenticationOptions(userId: string | null) {
  const { rpID } = relyingParty();
  const allowCredentials = userId
    ? (await prisma.passkey.findMany({ where: { userId }, select: { credentialId: true, transports: true } })).map((p) => ({
        id: p.credentialId,
        transports: p.transports,
      }))
    : undefined;
  const options = await generateAuthenticationOptions({ rpID, allowCredentials, userVerification: "required" });
  await storeChallenge(options.challenge, userId ? "assert" : "login", userId);
  return options;
}

/**
 * Verifies an assertion. With `userId`, the passkey must belong to that user; without it (discoverable sign-in) the
 * owner is looked up from the credential. Returns the owner's id, or null.
 */
export async function verifyPasskey(response: AuthenticationResponseJSON, userId: string | null): Promise<string | null> {
  const passkey = await prisma.passkey.findUnique({ where: { credentialId: response.id } });
  if (!passkey || (userId && passkey.userId !== userId)) return null;
  const { rpID, origin } = relyingParty();
  const purpose: ChallengePurpose = userId ? "assert" : "login";
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: (challenge) => consumeChallenge(challenge, purpose, userId),
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: Number(passkey.counter),
      transports: passkey.transports,
    },
  }).catch(() => null);
  if (!result?.verified) return null;
  // A counter that fails to increase suggests a cloned authenticator; synced passkeys always report 0.
  const { newCounter } = result.authenticationInfo;
  if (passkey.counter > BigInt(0) && BigInt(newCounter) <= passkey.counter) return null;
  await prisma.passkey.update({
    where: { id: passkey.id },
    data: { counter: BigInt(newCounter), lastUsedAt: new Date() },
  });
  return passkey.userId;
}
