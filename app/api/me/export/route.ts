import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

const sections = ["articles", "comments", "claps", "bookmarks", "following", "followers", "views", "feedback"] as const;
const take = 20;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const limit = await rateLimit(`export:${userId}`, 10, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const section = req.nextUrl.searchParams.get("section");
  const cursor = req.nextUrl.searchParams.get("cursor");
  if ((cursor && cursor.length > 128) || (section && !sections.some((value) => value === section))) {
    return NextResponse.json({ error: "Invalid export section or cursor" }, { status: 400 });
  }
  audit("data_export", "success");
  const headers = { "Cache-Control": "private, no-store", "Content-Disposition": 'attachment; filename="nystara-export.json"' };
  if (!section) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, emailVerified: true, name: true, username: true,
        bio: true, avatarUrl: true, image: true, createdAt: true, stripeCustomerId: true,
        accounts: { select: { provider: true, providerAccountId: true } },
        subscription: { select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true } },
        mfaEnabled: true, totpEnabledAt: true, emailTheme: true, activityEmails: true,
        passkeys: { select: { name: true, createdAt: true, lastUsedAt: true, deviceType: true, backedUp: true } },
      },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ exportedAt: new Date().toISOString(), user, sections: sections.map((value) => `/api/me/export?section=${value}`) }, { headers });
  }
  const byId = { ...(cursor ? { id: { gt: cursor } } : {}) };
  const options = { take: take + 1, orderBy: { id: "asc" as const } };
  let rows: object[];
  let keys: string[];
  switch (section) {
    case "articles": {
      const data = await prisma.article.findMany({ where: { authorId: userId, ...byId }, ...options,
        select: { id: true, slug: true, title: true, subtitle: true, content: true, contentText: true, coverImage: true, published: true, memberOnly: true, createdAt: true, updatedAt: true, publishedAt: true, tags: { select: { tag: { select: { slug: true } } } } } });
      rows = data; keys = data.map((row) => row.id); break;
    }
    case "comments": {
      const data = await prisma.comment.findMany({ where: { authorId: userId, ...byId }, ...options,
        select: { id: true, articleId: true, parentId: true, body: true, createdAt: true, deletedAt: true } });
      rows = data; keys = data.map((row) => row.id); break;
    }
    case "views": {
      const data = await prisma.articleView.findMany({ where: { visitorId: userId, ...byId }, ...options,
        select: { id: true, articleId: true, createdAt: true } });
      rows = data; keys = data.map((row) => row.id); break;
    }
    case "claps": {
      const data = await prisma.clap.findMany({ where: { userId, ...(cursor ? { articleId: { gt: cursor } } : {}) }, take: take + 1, orderBy: { articleId: "asc" }, select: { articleId: true, count: true } });
      rows = data; keys = data.map((row) => row.articleId); break;
    }
    case "bookmarks": {
      const data = await prisma.bookmark.findMany({ where: { userId, ...(cursor ? { articleId: { gt: cursor } } : {}) }, take: take + 1, orderBy: { articleId: "asc" }, select: { articleId: true, createdAt: true } });
      rows = data; keys = data.map((row) => row.articleId); break;
    }
    case "feedback": {
      const data = await prisma.articleFeedback.findMany({ where: { userId, ...(cursor ? { articleId: { gt: cursor } } : {}) }, take: take + 1, orderBy: { articleId: "asc" }, select: { articleId: true, reaction: true, rating: true, updatedAt: true } });
      rows = data; keys = data.map((row) => row.articleId); break;
    }
    case "following": {
      const data = await prisma.follow.findMany({ where: { followerId: userId, ...(cursor ? { followingId: { gt: cursor } } : {}) }, take: take + 1, orderBy: { followingId: "asc" }, select: { followingId: true, createdAt: true } });
      rows = data; keys = data.map((row) => row.followingId); break;
    }
    default: {
      const data = await prisma.follow.findMany({ where: { followingId: userId, ...(cursor ? { followerId: { gt: cursor } } : {}) }, take: take + 1, orderBy: { followerId: "asc" }, select: { followerId: true, createdAt: true } });
      rows = data; keys = data.map((row) => row.followerId);
    }
  }
  const next = rows.length > take ? `/api/me/export?section=${section}&cursor=${encodeURIComponent(keys[take - 1])}` : null;
  return NextResponse.json({ section, records: rows.slice(0, take), next }, { headers });
}
