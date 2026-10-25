import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const { prisma } = await import("../lib/prisma");
  try {
    const before = new Date(Date.now() - 30 * 86400_000);
    await prisma.articleView.deleteMany({ where: { createdAt: { lt: before } } });
    await prisma.verificationToken.deleteMany({ where: { expires: { lt: new Date() } } });
    await prisma.session.deleteMany({ where: { expires: { lt: new Date() } } });
    console.info("Expired reader views, verification tokens and sessions removed");
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error("Retention cleanup failed");
  process.exitCode = 1;
});
