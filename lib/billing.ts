import type Stripe from "stripe";
import type { SubStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export function toSubStatus(status: Stripe.Subscription.Status): SubStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "CANCELED";
    default:
      return "PAST_DUE";
  }
}

/** The subscription id an event refers to, or null when the event carries none. */
export function eventSubscriptionId(event: Stripe.Event): string | null {
  const object = event.data.object;
  if (event.type === "checkout.session.completed") {
    const session = object as Stripe.Checkout.Session;
    if (session.mode !== "subscription" || !session.subscription) return null;
    return typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  }
  if (event.type.startsWith("customer.subscription.")) return (object as Stripe.Subscription).id;
  return null;
}

/**
 * Records the event and mirrors the subscription in one transaction.
 * Returns false when the event was already processed.
 */
export async function recordStripeEvent(event: Stripe.Event, subscription: Stripe.Subscription | null): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const seen = await tx.stripeEvent.findUnique({ where: { id: event.id }, select: { id: true } });
    if (seen) return false;
    await tx.stripeEvent.create({ data: { id: event.id, type: event.type } });
    if (!subscription) return true;

    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const user = await tx.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
    if (!user) return true;

    const item = subscription.items.data[0];
    const status = toSubStatus(subscription.status);
    const existing = await tx.subscription.findUnique({
      where: { userId: user.id },
      select: { stripeSubscriptionId: true, status: true },
    });
    // A late event for an old, ended subscription must not replace a newer live one.
    if (
      existing &&
      existing.stripeSubscriptionId !== subscription.id &&
      status === "CANCELED" &&
      (existing.status === "ACTIVE" || existing.status === "TRIALING")
    ) return true;

    const data = {
      stripeSubscriptionId: subscription.id,
      stripePriceId: item?.price.id ?? "",
      status,
      currentPeriodEnd: new Date((item?.current_period_end ?? subscription.ended_at ?? Math.floor(Date.now() / 1000)) * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
    await tx.subscription.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
    return true;
  });
}
