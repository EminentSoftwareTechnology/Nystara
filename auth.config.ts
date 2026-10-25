import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";
import Nodemailer from "next-auth/providers/nodemailer";
import type { EmailConfig } from "next-auth/providers/email";
import { jwtVerify } from "jose";

const ADMIN_COOKIE = "admin_session";

/**
 * Sign-in emails link to /verify, which spends the one-time token only when the person presses Continue. Mail
 * scanners, link previews and repeat clicks all fetch the link, and would otherwise use up the token first.
 */
function confirmBeforeSignIn(provider: EmailConfig): EmailConfig {
  return {
    ...provider,
    maxAge: 24 * 60 * 60,
    async sendVerificationRequest(params) {
      const callback = new URL(params.url);
      const confirm = new URL("/verify", callback.origin);
      confirm.search = callback.search;
      confirm.searchParams.set("provider", provider.id);
      const { sendSignInEmail } = await import("@/lib/email/auth");
      return sendSignInEmail({ ...params, url: confirm.toString() });
    },
  };
}

async function isValidAdminToken(token: string): Promise<boolean> {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      audience: "nystara:admin",
    });
    return payload.role === "ADMIN";
  } catch {
    return false;
  }
}

// Edge-safe config: no Prisma/Node-only imports.
// Imported by both middleware.ts and lib/auth.ts.
export const authConfig = {
  // NextAuth normalizes requests and internal action URLs to this configured origin.
  trustHost: Boolean(process.env.NEXTAUTH_URL),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    confirmBeforeSignIn(
      process.env.NODE_ENV === "production"
        ? Resend({
            apiKey: process.env.RESEND_API_KEY!,
            from: "noreply@nystara.com",
          })
        : Nodemailer({
            server: process.env.EMAIL_SERVER ?? "smtp://127.0.0.1:1035",
            from: process.env.EMAIL_FROM ?? "Nystara <noreply@nystara.local>",
          }),
    ),
  ],
  pages: { error: "/sign-in-error" },
  callbacks: {
    async authorized({ auth, request }) {
      const { pathname } = request.nextUrl;

      if (pathname.startsWith("/admin")) {
        if (pathname === "/admin/login") return true;
        const token = request.cookies.get(ADMIN_COOKIE)?.value;
        const valid = !!token && (await isValidAdminToken(token));
        if (!valid) {
          return Response.redirect(new URL("/admin/login", request.url));
        }
        return true;
      }

      if (pathname.startsWith("/me") || pathname.startsWith("/new-story")) {
        return !!auth?.user;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
