import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const { prisma } = await import("../lib/prisma");
  try {
    const before = new Date(Date.now() - 30 * 86400_000);
    await prisma.articleView.deleteMany({ where: { createdAt: { lt: before } } });
    await prisma.verificationToken.deleteMany({ where: { expires: { lt: new Date() } } });
    await prisma.session.deleteMany({ where: { expires: { lt: new Date() } } });
    await prisma.authChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    // Confirmation links last 7 days; unconfirmed digest signups are deleted after that.
    await prisma.subscriber.deleteMany({ where: { confirmedAt: null, createdAt: { lt: new Date(Date.now() - 7 * 86400_000) } } });
    console.info("Expired reader views, verification tokens, sessions, passkey challenges and unconfirmed digest signups removed");
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error("Retention cleanup failed");
  process.exitCode = 1;
});
