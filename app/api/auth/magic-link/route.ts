import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signIn } from "@/lib/auth";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimit } from "@/lib/rate-limit";
import { readJson } from "@/lib/request";

const schema = z.object({
  email: z.string().email().max(254),
  turnstileToken: z.string().min(1).max(4096),
});

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, turnstileToken } = parsed.data;

  const valid = await verifyTurnstile(turnstileToken);
  if (!valid) {
    return NextResponse.json({ error: "CAPTCHA verification failed" }, { status: 400 });
  }

  const limit = await rateLimit(`magic-link:${email.trim().toLowerCase()}`, 3, 15 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

  try {
    await signIn(process.env.NODE_ENV === "production" ? "resend" : "nodemailer", { email, redirect: false });
  } catch {
    return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
