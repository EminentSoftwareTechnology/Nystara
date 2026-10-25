import { notifyEmail } from "@/lib/email/notifications";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { eraseUserImages } from "@/lib/r2";

// GDPR Art. 17 erasure. Owned rows (articles, comments, claps, bookmarks,
// follows, sessions, accounts, subscription, digest) cascade at the DB level.
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

  await eraseUserImages(userId);
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: email } }),
    // A visitor signup for the same address; the member's own row cascades with the user.
    prisma.subscriber.deleteMany({ where: { email } }),
    prisma.articleView.deleteMany({ where: { visitorId: userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
  audit("account_erasure", "success");
  await notifyEmail(email, "account-deleted");
}
