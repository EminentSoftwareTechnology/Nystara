import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createOAuthTurnstileToken,
  OAUTH_TURNSTILE_COOKIE,
  OAUTH_TURNSTILE_MAX_AGE,
} from "@/lib/oauth-turnstile";
import { verifyTurnstile } from "@/lib/turnstile";
import { readJson } from "@/lib/request";

const schema = z.object({
  turnstileToken: z.string().min(1).max(4096),
});

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const valid = await verifyTurnstile(parsed.data.turnstileToken);
  if (!valid) {
    return NextResponse.json(
      { error: "CAPTCHA verification failed" },
      { status: 400 },
    );
  }

  const token = await createOAuthTurnstileToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OAUTH_TURNSTILE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_TURNSTILE_MAX_AGE,
  });
  return res;
}
