import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { isProLaunched } from "@/lib/pro";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to upgrade." }, { status: 401 });
  const userId = session.user.id;
  if (!(await isProLaunched())) return NextResponse.json({ error: "Pro is not on sale yet. Every feature is free for now." }, { status: 409 });
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });

  const limit = await rateLimit(`billing:${userId}`, 10, 3600_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, stripeCustomerId: true, subscription: { select: { status: true } } },
  });
  if (!user) return NextResponse.json({ error: "Sign in to upgrade." }, { status: 401 });
  // Past-due or live subscriptions are managed in the billing portal, never duplicated.
  if (user.subscription && user.subscription.status !== "CANCELED")
    return NextResponse.json({ error: "You already have a subscription. Manage it from Billing." }, { status: 409 });

  const { stripe } = await import("@/lib/stripe");
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId } }, { idempotencyKey: `customer:${userId}` });
    customerId = customer.id;
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }

  const base = process.env.NEXTAUTH_URL;
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { userId } },
    allow_promotion_codes: true,
    success_url: `${base}/settings/billing?checkout=success`,
    cancel_url: `${base}/pricing?checkout=canceled`,
  });
  if (!checkout.url) return NextResponse.json({ error: "Checkout could not start. Please retry." }, { status: 502 });
  return NextResponse.json({ url: checkout.url });
}
