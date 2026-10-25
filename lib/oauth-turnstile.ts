import { SignJWT, jwtVerify } from "jose";

export const OAUTH_TURNSTILE_COOKIE = "oauth_turnstile";
export const OAUTH_TURNSTILE_MAX_AGE = 5 * 60;

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("ADMIN_JWT_SECRET or NEXTAUTH_SECRET must be set");
  }
  return new TextEncoder().encode(secret);
}

export async function createOAuthTurnstileToken(): Promise<string> {
  return new SignJWT({ purpose: "oauth-turnstile" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_TURNSTILE_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifyOAuthTurnstileToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.purpose === "oauth-turnstile";
  } catch {
    return false;
  }
}
