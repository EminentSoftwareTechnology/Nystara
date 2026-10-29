import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { readBody } from "@/lib/request";
import { HANDLED_EVENTS, eventSubscriptionId, recordStripeEvent } from "@/lib/billing";

// Stripe sends no Origin header; proxy.ts exempts this path from the same-origin check and the signature replaces it.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const { stripe } = await import("@/lib/stripe");
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await readBody(req), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const subscriptionId = HANDLED_EVENTS.has(event.type) ? eventSubscriptionId(event) : null;
  // Stripe is the source of truth: re-read the subscription instead of trusting the event's snapshot order.
  const subscription = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;
  await recordStripeEvent(event, subscription);
  return NextResponse.json({ received: true });
}
