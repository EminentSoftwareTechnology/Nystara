import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const { prisma } = await import("../lib/prisma");
  try {
    const before = new Date(Date.now() - 30 * 86400_000);
    const now = new Date();
    await prisma.userActivityDay.deleteMany({ where: { day: { lt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)) } } });
    await prisma.articleView.deleteMany({ where: { createdAt: { lt: before } } });
    await prisma.verificationToken.deleteMany({ where: { expires: { lt: new Date() } } });
    await prisma.session.deleteMany({ where: { expires: { lt: new Date() } } });
    await prisma.authChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    // Confirmation links last 7 days; unconfirmed digest signups are deleted after that.
    await prisma.subscriber.deleteMany({ where: { confirmedAt: null, createdAt: { lt: new Date(Date.now() - 7 * 86400_000) } } });
    // Stripe retries a webhook for at most 3 days, so older event ids are no longer needed for de-duplication.
    await prisma.stripeEvent.deleteMany({ where: { createdAt: { lt: before } } });
    console.info("Expired reader views, verification tokens, sessions, passkey challenges, unconfirmed digest signups and old Stripe event ids removed");
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error("Retention cleanup failed");
  process.exitCode = 1;
});
