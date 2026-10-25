import { prisma } from "@/lib/prisma";

const FREE_LIMIT = 5;
const WINDOW_DAYS = 30;
const EXCERPT_WORD_COUNT = 300;

export function extractExcerpt(contentText: string): string {
  const words = contentText.trim().split(/\s+/);
  if (words.length <= EXCERPT_WORD_COUNT) return contentText;
  return words.slice(0, EXCERPT_WORD_COUNT).join(" ") + "…";
}

export async function checkPaywallAccess(
  visitorId: string,
  articleId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);

  const [alreadyViewed, count] = await prisma.$transaction([
    prisma.articleView.findFirst({
      where: { visitorId, articleId, createdAt: { gte: windowStart } },
      select: { id: true },
    }),
    prisma.articleView.count({
      where: { visitorId, createdAt: { gte: windowStart } },
    }),
  ]);

  if (alreadyViewed) {
    return { allowed: true, remaining: Math.max(0, FREE_LIMIT - count) };
  }

  if (count >= FREE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  // Re-check count inside a transaction to prevent quota over-run under concurrent requests
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.articleView.count({
      where: { visitorId, createdAt: { gte: windowStart } },
    });
    if (current >= FREE_LIMIT) return { allowed: false, remaining: 0 };
    await tx.articleView.create({ data: { visitorId, articleId } });
    return { allowed: true, remaining: FREE_LIMIT - current - 1 };
  });

  return result;
}
