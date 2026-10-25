import { SignJWT, jwtVerify } from "jose";

function key() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for unsubscribe links");
  return new TextEncoder().encode(secret);
}

export async function unsubscribeToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: "activity-unsubscribe" }).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setAudience("nystara:email").setIssuedAt().setExpirationTime("365d").sign(key());
}

export async function unsubscribeUserId(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], audience: "nystara:email" });
    return payload.purpose === "activity-unsubscribe" && typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}
