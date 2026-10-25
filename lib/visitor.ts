import { SignJWT, jwtVerify } from "jose";

export const VISITOR_COOKIE = "reader_session";
export const VISITOR_MAX_AGE = 30 * 24 * 60 * 60;
const audience = "nystara:reader";

function readerSecret() {
  if (!process.env.NEXTAUTH_SECRET) throw new Error("NEXTAUTH_SECRET must be set");
  return new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
}

/** The anonymous reader id carried by a valid reader cookie, or null. */
export async function verifiedReaderId(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, readerSecret(), { audience, algorithms: ["HS256"] });
    if (typeof payload.sub === "string" && /^anon-[a-f0-9-]{36}$/.test(payload.sub)) return payload.sub;
  } catch { /* Expired or invalid cookies receive a fresh random identity. */ }
  return null;
}

export async function readerIdentity(token?: string) {
  const secret = readerSecret();
  const existing = token ? await verifiedReaderId(token) : null;
  if (existing) return { id: existing, token: null };
  const id = `anon-${crypto.randomUUID()}`;
  const signed = await new SignJWT({}).setProtectedHeader({ alg: "HS256" })
    .setSubject(id).setAudience(audience).setIssuedAt().setExpirationTime(`${VISITOR_MAX_AGE}s`).sign(secret);
  return { id, token: signed };
}
