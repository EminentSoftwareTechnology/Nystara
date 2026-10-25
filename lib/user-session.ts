import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const MAX_AGE = 30 * 24 * 60 * 60; // Auth.js default database session lifetime

/** Matches Auth.js: the `__Secure-` prefix is used when the configured URL is HTTPS. */
function secureCookies(): boolean {
  return (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
}

function cookieName(): string {
  return `${secureCookies() ? "__Secure-" : ""}authjs.session-token`;
}

export async function currentSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(cookieName())?.value;
}

/** Records that this session completed its second factor. */
export async function markSessionMfaVerified(): Promise<void> {
  const sessionToken = await currentSessionToken();
  if (!sessionToken) return;
  await prisma.session.updateMany({ where: { sessionToken }, data: { mfaVerifiedAt: new Date() } });
}

/** Starts an Auth.js database session after a passkey sign-in. A passkey is itself a strong second factor. */
export async function startVerifiedSession(userId: string): Promise<void> {
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + MAX_AGE * 1000);
  await prisma.session.create({ data: { sessionToken, userId, expires, mfaVerifiedAt: new Date() } });
  (await cookies()).set(cookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secureCookies(),
    expires,
  });
}
