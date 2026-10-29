import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";

export { AI_DAILY_LIMIT, PRO_PRICE, PRO_THEMES, isProTheme } from "@/lib/plans";

export type Plan = {
  /** Admin has put Pro on sale. */
  launched: boolean;
  /** The member has a paid Pro subscription in good standing. */
  subscribed: boolean;
  /** The member can use Pro features: everyone before launch, subscribers after. */
  pro: boolean;
};

export function planFor(
  launched: boolean,
  subscription: { status: string; currentPeriodEnd: Date } | null,
): Plan {
  const subscribed = hasPremiumAccess(subscription);
  return { launched, subscribed, pro: !launched || subscribed };
}

export const isProLaunched = cache(async (): Promise<boolean> => {
  const setting = await prisma.siteSetting.findUnique({ where: { id: "site" }, select: { proEnabled: true } });
  return setting?.proEnabled ?? false;
});

export const getPlan = cache(async (userId: string): Promise<Plan> => {
  const [launched, subscription] = await Promise.all([
    isProLaunched(),
    prisma.subscription.findUnique({ where: { userId }, select: { status: true, currentPeriodEnd: true } }),
  ]);
  return planFor(launched, subscription);
});

/** Pro cannot go on sale until checkout, the price and the webhook are all configured. */
export function stripeConfig() {
  return {
    secretKey: !!process.env.STRIPE_SECRET_KEY,
    priceId: !!process.env.STRIPE_PRO_PRICE_ID,
    webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
  };
}

export function stripeReady(): boolean {
  return Object.values(stripeConfig()).every(Boolean);
}
