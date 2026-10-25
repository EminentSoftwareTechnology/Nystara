import { prisma } from "@/lib/prisma";

const FREE_LIMIT = 5;
const WINDOW_DAYS = 30;
const EXCERPT_WORD_COUNT = 300;

export function extractExcerpt(contentText: string): string {
  const words = contentText.trim().split(/\s+/);
  if (words.length <= EXCERPT_WORD_COUNT) return contentText;
  return words.slice(0, EXCERPT_WORD_COUNT).join(" ") + "…";
}

export async function checkPaywallAccess(visitorId: string, articleId: string) {
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 86400_000);
  return prisma.$transaction(async (tx) => {
    // Serialize quota checks across all replicas, including repeat views of the same article.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${visitorId}, 0))::text`;
    const existing = await tx.articleView.findFirst({
      where: { visitorId, articleId, createdAt: { gte: windowStart } }, select: { id: true },
    });
    const count = await tx.articleView.count({ where: { visitorId, createdAt: { gte: windowStart } } });
    if (existing) return { allowed: true, remaining: Math.max(0, FREE_LIMIT - count) };
    if (count >= FREE_LIMIT) return { allowed: false, remaining: 0 };
    await tx.articleView.create({ data: { visitorId, articleId } });
    return { allowed: true, remaining: FREE_LIMIT - count - 1 };
  });
}
