import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import {
  OAUTH_TURNSTILE_COOKIE,
  verifyOAuthTurnstileToken,
} from "@/lib/oauth-turnstile";
import { randomUUID } from "node:crypto";

export const { handlers, auth, signIn, signOut } = NextAuth((req) => ({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
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
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
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
