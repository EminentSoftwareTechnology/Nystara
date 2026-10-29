import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

const sections = ["articles", "comments", "claps", "bookmarks", "following", "followers", "views", "feedback", "readingLists", "readingListItems", "savedLists", "highlights", "topicFollows", "aiConversations", "aiMessages", "activity"] as const;
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
        mfaEnabled: true, totpEnabledAt: true, emailTheme: true, activityEmails: true, readingHistoryClearedAt: true,
        digest: { select: { frequency: true, confirmedAt: true, lastSentAt: true, createdAt: true } },
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
    case "activity": {
      if (cursor && !/^\d{4}-\d{2}-\d{2}$/.test(cursor)) return NextResponse.json({ error: "Invalid activity cursor" }, { status: 400 });
      const day = cursor ? new Date(`${cursor}T00:00:00Z`) : null;
      if (day && (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== cursor)) return NextResponse.json({ error: "Invalid activity cursor" }, { status: 400 });
      const data = await prisma.userActivityDay.findMany({ where: { userId, ...(day ? { day: { gt: day } } : {}) }, take: take + 1, orderBy: { day: "asc" }, select: { day: true } });
      rows = data; keys = data.map((row) => row.day.toISOString().slice(0, 10)); break;
    }
    case "articles": {
      const data = await prisma.article.findMany({ where: { authorId: userId, ...byId }, ...options,
        select: { id: true, slug: true, title: true, subtitle: true, content: true, contentText: true, coverImage: true, published: true, memberOnly: true, unlisted: true, scheduledAt: true, submittedAt: true, createdAt: true, updatedAt: true, publishedAt: true, tags: { select: { tag: { select: { slug: true } } } } } });
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
    case "readingLists": {
      const data = await prisma.readingList.findMany({ where: { userId, ...byId }, ...options, select: { id: true, name: true, description: true, isPublic: true, createdAt: true, updatedAt: true } });
      rows = data; keys = data.map((row) => row.id); break;
    }
    case "readingListItems": {
      const [listId, articleId] = cursor?.split(":") ?? [];
      if (cursor && (!listId || !articleId)) return NextResponse.json({ error: "Invalid list item cursor" }, { status: 400 });
      const data = await prisma.readingListItem.findMany({ where: { list: { userId }, ...(listId && articleId ? { OR: [{ listId: { gt: listId } }, { listId, articleId: { gt: articleId } }] } : {}) }, take: take + 1, orderBy: [{ listId: "asc" }, { articleId: "asc" }], select: { listId: true, articleId: true, createdAt: true } });
      rows = data; keys = data.map((row) => `${row.listId}:${row.articleId}`); break;
    }
    case "savedLists": {
      const data = await prisma.savedList.findMany({ where: { userId, ...(cursor ? { listId: { gt: cursor } } : {}) }, take: take + 1, orderBy: { listId: "asc" }, select: { listId: true, createdAt: true } });
      rows = data; keys = data.map((row) => row.listId); break;
    }
    case "highlights": {
      const data = await prisma.highlight.findMany({ where: { userId, ...byId }, ...options, select: { id: true, articleId: true, quote: true, note: true, createdAt: true } });
      rows = data; keys = data.map((row) => row.id); break;
    }
    case "topicFollows": {
      const data = await prisma.topicFollow.findMany({ where: { userId, ...(cursor ? { tagId: { gt: cursor } } : {}) }, take: take + 1, orderBy: { tagId: "asc" }, select: { tagId: true, createdAt: true } });
      rows = data; keys = data.map((row) => row.tagId); break;
    }
    case "aiConversations": {
      const data = await prisma.aiConversation.findMany({ where: { userId, ...byId }, ...options, select: { id: true, title: true, createdAt: true, updatedAt: true } });
      rows = data; keys = data.map((row) => row.id); break;
    }
    case "aiMessages": {
      const data = await prisma.aiMessage.findMany({ where: { conversation: { userId }, ...byId }, ...options, select: { id: true, conversationId: true, role: true, content: true, attachments: true, createdAt: true } });
      rows = data; keys = data.map((row) => row.id); break;
    }
    default: {
      const data = await prisma.follow.findMany({ where: { followingId: userId, ...(cursor ? { followerId: { gt: cursor } } : {}) }, take: take + 1, orderBy: { followerId: "asc" }, select: { followerId: true, createdAt: true } });
      rows = data; keys = data.map((row) => row.followerId);
    }
  }
  const next = rows.length > take ? `/api/me/export?section=${section}&cursor=${encodeURIComponent(keys[take - 1])}` : null;
  return NextResponse.json({ section, records: rows.slice(0, take), next }, { headers });
}
