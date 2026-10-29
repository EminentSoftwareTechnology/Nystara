import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { stripeCustomerId: true } });
  if (!user?.stripeCustomerId) return NextResponse.json({ error: "You have no billing account yet." }, { status: 404 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });

  const limit = await rateLimit(`billing:${session.user.id}`, 10, 3600_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

  const { stripe } = await import("@/lib/stripe");
  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXTAUTH_URL}/settings/billing`,
  });
  return NextResponse.json({ url: portal.url });
}
