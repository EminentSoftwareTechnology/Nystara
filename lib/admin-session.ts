import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const COOKIE_NAME = "admin_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours
// Distinguishes admin tokens from other JWTs signed with the same secret (e.g. oauth-turnstile).
export const ADMIN_AUDIENCE = "nystara:admin";

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("generate-")) {
    throw new Error("ADMIN_JWT_SECRET must contain at least 32 random characters");
  }
  return new TextEncoder().encode(secret);
}

export type AdminPayload = {
  sub: string;
  email: string;
  role: string;
  version: number;
};

export async function createAdminSession(payload: AdminPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(ADMIN_AUDIENCE)
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      audience: ADMIN_AUDIENCE,
    });
    if (payload.role !== "ADMIN" || typeof payload.sub !== "string" ||
      typeof payload.email !== "string" || !Number.isSafeInteger(payload.version)) return null;
    return { sub: payload.sub, email: payload.email, role: payload.role, version: payload.version as number };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function setAdminSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function getAdminTokenFromRequest(req: NextRequest): string | undefined {
  return req.cookies.get(COOKIE_NAME)?.value;
}

// Short-lived proof that the password step succeeded for an admin who still owes a second factor.
const MFA_PENDING_COOKIE = "admin_mfa_pending";
const MFA_PENDING_AUDIENCE = "nystara:admin-mfa";
const MFA_PENDING_MAX_AGE = 5 * 60;

export async function setAdminMfaPending(userId: string, version: number): Promise<void> {
  const token = await new SignJWT({ version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setAudience(MFA_PENDING_AUDIENCE)
    .setExpirationTime(`${MFA_PENDING_MAX_AGE}s`)
    .sign(getSecret());
  (await cookies()).set(MFA_PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin/login",
    maxAge: MFA_PENDING_MAX_AGE,
  });
}

export async function getAdminMfaPending(): Promise<{ sub: string; version: number } | null> {
  const token = (await cookies()).get(MFA_PENDING_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"], audience: MFA_PENDING_AUDIENCE });
    if (typeof payload.sub !== "string" || !Number.isSafeInteger(payload.version)) return null;
    return { sub: payload.sub, version: payload.version as number };
  } catch {
    return null;
  }
}

export async function clearAdminMfaPending(): Promise<void> {
  (await cookies()).set(MFA_PENDING_COOKIE, "", { path: "/api/admin/login", maxAge: 0 });
}
