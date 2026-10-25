import { loadEnvConfig } from "@next/env";

// Run on a schedule (hourly or daily). Each subscriber gets at most one digest per period.
async function main() {
  loadEnvConfig(process.cwd());
  const { prisma } = await import("../lib/prisma");
  const { sendDueDigests } = await import("../lib/digest");
  try {
    const stats = await sendDueDigests();
    console.info(`Digests sent: ${stats.sent}, failed: ${stats.failed}, skipped (nothing new): ${stats.skipped}`);
    if (stats.failed) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error("Digest run failed");
  process.exitCode = 1;
});
