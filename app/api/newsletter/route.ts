import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/client-ip";
import { DIGEST_FREQUENCIES, requestSubscription } from "@/lib/digest";
import { blindIndex } from "@/lib/field-encryption";
import { rateLimit } from "@/lib/rate-limit";
import { readJson } from "@/lib/request";
import { verifyTurnstile } from "@/lib/turnstile";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  frequency: z.enum(DIGEST_FREQUENCIES),
  turnstileToken: z.string().min(1).max(2048),
});

const accepted = () => NextResponse.json({ message: "Check your inbox to confirm your subscription." }, { status: 202 });

export async function POST(request: Request) {
  const input = schema.safeParse(await readJson(request));
  if (!input.success) return NextResponse.json({ error: "Enter a valid email and choose how often." }, { status: 400 });
  const ip = getClientIp(request.headers);
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`newsletter:ip:${ip}`, 10, 3600_000),
    rateLimit(`newsletter:email:${blindIndex(input.data.email)}`, 3, 3600_000),
  ]);
  if (!byIp.ok) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429, headers: { "Retry-After": String(byIp.retryAfter) } });
  if (!(await verifyTurnstile(input.data.turnstileToken))) return NextResponse.json({ error: "Verification failed. Please retry." }, { status: 400 });
  // Same response when the per-address limit is hit, so it can't be used to probe for subscribers.
  if (!byEmail.ok) return accepted();
  try {
    await requestSubscription(input.data.email, input.data.frequency);
  } catch {
    console.error("Digest confirmation failed");
    return NextResponse.json({ error: "We couldn't send the confirmation email. Please retry." }, { status: 502 });
  }
  return accepted();
}
