import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import {
  OAUTH_TURNSTILE_COOKIE,
  verifyOAuthTurnstileToken,
} from "@/lib/oauth-turnstile";
import { slugify } from "@/lib/slug";

async function generateUsername(email: string): Promise<string> {
  const base = slugify(email.split("@")[0]) || "user";
  const existing = await prisma.user.findMany({
    where: { username: { startsWith: base } },
    select: { username: true },
  });
  if (!existing.some((u) => u.username === base)) return base;
  const suffixes = existing
    .map((u) => {
      const match = u.username?.match(
        new RegExp(`^${escapeRegex(base)}-(\\d+)$`),
      );
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(Boolean);
  const next = suffixes.length > 0 ? Math.max(...suffixes) + 1 : 2;
  return `${base}-${next}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const { handlers, auth, signIn, signOut } = NextAuth((req) => ({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account }) {
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
      const username = await generateUsername(user.email);
      await prisma.user.update({ where: { id: user.id }, data: { username } });
    },
  },
}));
