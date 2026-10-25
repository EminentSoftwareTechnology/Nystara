import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const COOKIE_NAME = "admin_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours
// Distinguishes admin tokens from other JWTs signed with the same secret (e.g. oauth-turnstile).
export const ADMIN_AUDIENCE = "techscribe:admin";

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET must be set");
  return new TextEncoder().encode(secret);
}

export type AdminPayload = {
  sub: string;
  email: string;
  role: string;
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
    if (payload.role !== "ADMIN" || typeof payload.sub !== "string") return null;
    return payload as unknown as AdminPayload;
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
