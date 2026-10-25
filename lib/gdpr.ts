import { prisma } from "@/lib/prisma";

// GDPR Art. 17 erasure. Owned rows (articles, comments, claps, bookmarks,
// follows, sessions, accounts, subscription) cascade at the DB level.
export async function eraseUser(userId: string, email: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeSubscriptionId: true, status: true },
  });
  // Stop billing before the local record disappears.
  if (sub && sub.status !== "CANCELED") {
    const { stripe } = await import("@/lib/stripe");
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
  }

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: email } }),
    prisma.articleView.deleteMany({ where: { visitorId: userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
