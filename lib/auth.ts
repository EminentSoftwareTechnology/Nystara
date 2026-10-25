import NextAuth from "next-auth";
import { prisma } from "@/lib/prisma";
import { authAdapter } from "@/lib/auth-adapter";
import { authConfig } from "@/auth.config";
import {
  OAUTH_TURNSTILE_COOKIE,
  verifyOAuthTurnstileToken,
} from "@/lib/oauth-turnstile";
import { randomUUID } from "node:crypto";

function readDate(source: object, key: string): Date | null {
  const value: unknown = Reflect.get(source, key);
  return value instanceof Date ? value : null;
}

function readBoolean(source: object, key: string): boolean {
  return Reflect.get(source, key) === true;
}

const nextAuth = NextAuth((req) => ({
  ...authConfig,
  adapter: authAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, email }) {
      if (email?.verificationRequest) return req === undefined;
      if (account?.type === "oauth") {
        const token = req?.cookies.get(OAUTH_TURNSTILE_COOKIE)?.value;
        return verifyOAuthTurnstileToken(token);
      }

      return true;
    },
    // With database sessions, `session` carries the full Session row and `user` the full User row. Return only an
    // explicit allow-list: the raw rows include the session token, password hash and encrypted TOTP secret.
    async session({ session, user }) {
      const mfaEnabled = readBoolean(user, "mfaEnabled");
      const mfaPending = mfaEnabled && !readDate(session, "mfaVerifiedAt");
      const setupRequired = !mfaEnabled || !user.name?.trim();
      return {
        expires: session.expires,
        user: { id: user.id, name: user.name ?? null, email: user.email, image: user.image ?? null, mfaPending, setupRequired },
      };
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.email || !user.id) return;
      const username = `writer-${randomUUID()}`;
      await prisma.user.update({ where: { id: user.id }, data: { username } });
    },
  },
}));

export const { handlers, signIn, signOut } = nextAuth;

/**
 * The signed-in session, or null. A session still waiting on its second factor, or whose account has no display
 * name or second factor yet, counts as signed out until /mfa finishes.
 */
export async function auth() {
  const session = await nextAuth.auth();
  return session?.user?.mfaPending || session?.user?.setupRequired ? null : session;
}

/** The session while the account is being set up (name, passkey or authenticator). Only /mfa and its APIs use this. */
export async function authForAccountSetup() {
  const session = await nextAuth.auth();
  return session?.user?.mfaPending ? null : session;
}

/** The session even before MFA completes. Only the MFA challenge flow should use this. */
export async function authIncludingPendingMfa() {
  return nextAuth.auth();
}
