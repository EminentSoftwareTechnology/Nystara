import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimit } from "@/lib/rate-limit";
import { readJson } from "@/lib/request";

const schema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("login"),
    email: z.string().trim().email().max(254),
    turnstileToken: z.string().min(1).max(4096),
  }),
  z.object({
    intent: z.literal("signup"),
    email: z.string().trim().email().max(254),
    name: z.string().trim().min(1).max(100),
    turnstileToken: z.string().min(1).max(4096),
  }),
]);

/**
 * Sends a one-time sign-in link. Sign-in only mails existing accounts and sign-up only mails new ones, so each page
 * can point the person to the other. This reveals whether an email has an account; Turnstile and the credential
 * rate limits in proxy.ts bound how fast that can be probed.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address and display name." }, { status: 400 });
  }

  const input = parsed.data;
  const email = input.email.toLowerCase();

  if (!(await verifyTurnstile(input.turnstileToken))) {
    return NextResponse.json({ error: "CAPTCHA verification failed" }, { status: 400 });
  }

  // OAuth providers may have stored the address with capitals; Auth.js lowercases email-link addresses.
  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (input.intent === "login" && !existing) {
    return NextResponse.json({ error: "No account uses this email address.", code: "no_account" }, { status: 404 });
  }
  if (input.intent === "signup" && existing) {
    return NextResponse.json({ error: "An account already uses this email address.", code: "account_exists" }, { status: 409 });
  }

  const limit = await rateLimit(`magic-link:${email}`, 3, 15 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

  // The link lands on /mfa, which asks for a passkey or authenticator before the account can be used. A new
  // account's name rides along in the link so it works even when opened on another device.
  const redirectTo = input.intent === "signup" ? `/mfa?name=${encodeURIComponent(input.name)}` : "/mfa";
  try {
    await signIn(process.env.NODE_ENV === "production" ? "resend" : "nodemailer", { email, redirect: false, redirectTo });
  } catch {
    return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
