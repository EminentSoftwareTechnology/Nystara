import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VISITOR_COOKIE, verifiedReaderId } from "@/lib/visitor";

export type Voter = { voterId: string; userId: string | null };

/** The signed-in user, or the anonymous reader from the signed reader cookie. */
export async function currentVoter(): Promise<Voter | null> {
  const session = await auth();
  if (session?.user?.id) return { voterId: session.user.id, userId: session.user.id };
  const token = (await cookies()).get(VISITOR_COOKIE)?.value;
  const readerId = token ? await verifiedReaderId(token) : null;
  return readerId ? { voterId: readerId, userId: null } : null;
}

/** Same as currentVoter, for article pages where the proxy has already resolved the reader id. */
export async function pageVoter(userId: string | undefined): Promise<Voter | null> {
  if (userId) return { voterId: userId, userId };
  const readerId = (await headers()).get("x-reader-id");
  return readerId ? { voterId: readerId, userId: null } : null;
}

function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Counts one view per reader per article per UTC day. Members-only views are recorded by the paywall check. */
export async function recordView(articleId: string, visitorId: string) {
  const seen = await prisma.articleView.findFirst({
    where: { articleId, visitorId, createdAt: { gte: startOfUtcDay() } },
    select: { id: true },
  });
  if (!seen) await prisma.articleView.create({ data: { articleId, visitorId } });
}

export type FeedbackSummary = {
  likes: number;
  dislikes: number;
  ratingAverage: number | null;
  ratingCount: number;
  mine: { reaction: "LIKE" | "DISLIKE" | null; rating: number | null };
};

export async function feedbackSummary(articleId: string, voterId: string | null): Promise<FeedbackSummary> {
  const [reactions, rating, mine] = await Promise.all([
    prisma.articleFeedback.groupBy({
      by: ["reaction"],
      where: { articleId, reaction: { not: null } },
      _count: { _all: true },
    }),
    prisma.articleFeedback.aggregate({
      where: { articleId, rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    voterId
      ? prisma.articleFeedback.findUnique({
          where: { articleId_voterId: { articleId, voterId } },
          select: { reaction: true, rating: true },
        })
      : null,
  ]);
  const count = (type: "LIKE" | "DISLIKE") =>
    reactions.find((row) => row.reaction === type)?._count._all ?? 0;
  return {
    likes: count("LIKE"),
    dislikes: count("DISLIKE"),
    ratingAverage: rating._avg.rating === null ? null : Math.round(rating._avg.rating * 10) / 10,
    ratingCount: rating._count.rating,
    mine: { reaction: mine?.reaction ?? null, rating: mine?.rating ?? null },
  };
}

export type RankedArticle = {
  id: string;
  slug: string;
  title: string;
  username: string;
  topic: string | null;
  views: number;
};

async function rankedArticles(scores: Map<string, { score: number; views: number }>, limit: number) {
  const ids = [...scores.entries()].sort((a, b) => b[1].score - a[1].score).map(([id]) => id);
  const articles = await prisma.article.findMany({
    where: { id: { in: ids }, published: true, unlisted: false, author: { username: { not: null } } },
    select: {
      id: true,
      slug: true,
      title: true,
      author: { select: { username: true } },
      tags: { select: { tag: { select: { name: true } } }, take: 1 },
    },
  });
  const byId = new Map(articles.map((article) => [article.id, article]));
  return ids.flatMap((id): RankedArticle[] => {
    const article = byId.get(id);
    if (!article?.author.username) return [];
    return [{
      id,
      slug: article.slug,
      title: article.title,
      username: article.author.username,
      topic: article.tags[0]?.tag.name ?? null,
      views: scores.get(id)?.views ?? 0,
    }];
  }).slice(0, limit);
}

const TRENDING_WINDOW_MS = 48 * 3600_000;
const CANDIDATES = 50;

/** Stories gaining attention in the last 48 hours: reads, plus weighted likes and comments. */
export async function trendingArticles(limit = 5): Promise<RankedArticle[]> {
  const since = new Date(Date.now() - TRENDING_WINDOW_MS);
  const [views, likes, comments] = await Promise.all([
    prisma.articleView.groupBy({
      by: ["articleId"],
      where: { createdAt: { gte: since } },
      _count: { articleId: true },
      orderBy: { _count: { articleId: "desc" } },
      take: CANDIDATES,
    }),
    prisma.articleFeedback.groupBy({
      by: ["articleId"],
      where: { updatedAt: { gte: since }, reaction: "LIKE" },
      _count: { articleId: true },
      orderBy: { _count: { articleId: "desc" } },
      take: CANDIDATES,
    }),
    prisma.comment.groupBy({
      by: ["articleId"],
      where: { createdAt: { gte: since }, deletedAt: null },
      _count: { articleId: true },
      orderBy: { _count: { articleId: "desc" } },
      take: CANDIDATES,
    }),
  ]);
  const scores = new Map<string, { score: number; views: number }>();
  const add = (rows: { articleId: string; _count: { articleId: number } }[], weight: number, isView = false) => {
    for (const row of rows) {
      const entry = scores.get(row.articleId) ?? { score: 0, views: 0 };
      entry.score += row._count.articleId * weight;
      if (isView) entry.views = row._count.articleId;
      scores.set(row.articleId, entry);
    }
  };
  add(views, 1, true);
  add(likes, 3);
  add(comments, 5);
  return rankedArticles(scores, limit);
}

/** Most-read stories since midnight UTC. */
export async function mostViewedToday(limit = 5): Promise<RankedArticle[]> {
  const views = await prisma.articleView.groupBy({
    by: ["articleId"],
    where: { createdAt: { gte: startOfUtcDay() } },
    _count: { articleId: true },
    orderBy: { _count: { articleId: "desc" } },
    take: limit * 2,
  });
  const scores = new Map(
    views.map((row) => [row.articleId, { score: row._count.articleId, views: row._count.articleId }]),
  );
  return rankedArticles(scores, limit);
}
