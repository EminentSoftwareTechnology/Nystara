import { SignJWT, jwtVerify } from "jose";

export const VISITOR_COOKIE = "reader_session";
export const VISITOR_MAX_AGE = 30 * 24 * 60 * 60;
const audience = "nystara:reader";

export async function readerIdentity(token?: string) {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
  if (!process.env.NEXTAUTH_SECRET) throw new Error("NEXTAUTH_SECRET must be set");
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret, { audience, algorithms: ["HS256"] });
      if (typeof payload.sub === "string" && /^anon-[a-f0-9-]{36}$/.test(payload.sub)) {
        return { id: payload.sub, token: null };
      }
    } catch { /* Expired or invalid cookies receive a fresh random identity. */ }
  }
  const id = `anon-${crypto.randomUUID()}`;
  const signed = await new SignJWT({}).setProtectedHeader({ alg: "HS256" })
    .setSubject(id).setAudience(audience).setIssuedAt().setExpirationTime(`${VISITOR_MAX_AGE}s`).sign(secret);
  return { id, token: signed };
}
