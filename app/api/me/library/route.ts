import { rateLimit } from "@/lib/rate-limit";
import { extractExcerpt } from "@/lib/paywall";
import { hasPremiumAccess } from "@/lib/premium";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginWrite, readJson } from "@/lib/request";

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("createList"),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
    isPublic: z.boolean().default(false),
  }),
  z.object({ action: z.literal("deleteList"), listId: z.string().min(1) }),
  z.object({
    action: z.literal("bookmark"),
    articleId: z.string().min(1),
    saved: z.boolean(),
  }),
  z.object({
    action: z.literal("listItem"),
    articleId: z.string().min(1),
    listId: z.string().min(1),
    saved: z.boolean(),
  }),
  z.object({
    action: z.literal("saveList"),
    listId: z.string().min(1),
    saved: z.boolean(),
  }),
  z.object({
    action: z.literal("highlight"),
    articleId: z.string().min(1),
    quote: z.string().trim().min(1).max(3000),
    note: z.string().trim().max(2000).optional(),
  }),
  z.object({
    action: z.literal("deleteHighlight"),
    highlightId: z.string().min(1),
  }),
  z.object({ action: z.literal("clearHistory") }),
]);

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json(
      { error: "Sign in to use your library." },
      { status: 401 },
    );
  const userId = session.user.id;
  const articleId = new URL(req.url).searchParams.get("articleId");
  const [lists, bookmark] = await Promise.all([
    prisma.readingList.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        items: {
          where: articleId ? { articleId } : { articleId: "" },
          select: { articleId: true },
        },
      },
      take: 100,
    }),
    articleId
      ? prisma.bookmark.findUnique({
          where: { userId_articleId: { userId, articleId } },
          select: { articleId: true },
        })
      : null,
  ]);
  return Response.json({ lists, bookmarked: !!bookmark });
}

export async function POST(req: Request) {
  if (!isSameOriginWrite(req))
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id)
    return Response.json(
      { error: "Sign in to use your library." },
      { status: 401 },
    );
  const quota = await rateLimit(`library:${session.user.id}`, 120, 600_000);
  if (!quota.ok)
    return Response.json(
      { error: "Too many changes. Please try again later." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfter) } },
    );
  const parsed = inputSchema.safeParse(await readJson(req));
  if (!parsed.success)
    return Response.json(
      { error: "Check the fields and try again." },
      { status: 400 },
    );
  const userId = session.user.id;
  const input = parsed.data;
  let articleUnlisted = false;
  if ("articleId" in input && (input.action === "highlight" || input.saved)) {
    const article = await prisma.article.findFirst({
      where: { id: input.articleId, published: true },
      select: { id: true, contentText: true, memberOnly: true, authorId: true, unlisted: true },
    });
    if (!article)
      return Response.json({ error: "Story not found." }, { status: 404 });
    articleUnlisted = article.unlisted;
    if (input.action === "highlight") {
      let availableText = article.contentText;
      if (article.memberOnly && article.authorId !== userId) {
        const subscription = await prisma.subscription.findUnique({
          where: { userId },
          select: { status: true, currentPeriodEnd: true },
        });
        if (!hasPremiumAccess(subscription)) {
          const read = await prisma.articleView.findFirst({
            where: { visitorId: userId, articleId: article.id, createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
            select: { id: true },
          });
          if (!read) availableText = extractExcerpt(article.contentText);
        }
      }
      if (!availableText.includes(input.quote))
        return Response.json(
          { error: "Select a passage you can read in this story." },
          { status: 400 },
        );
    }
  }
  if (input.action === "createList") {
    if ((await prisma.readingList.count({ where: { userId } })) >= 100)
      return Response.json(
        { error: "You can create up to 100 lists." },
        { status: 400 },
      );
    const list = await prisma.readingList.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        isPublic: input.isPublic,
      },
    });
    return Response.json({ list });
  }
  if (input.action === "deleteList")
    await prisma.readingList.deleteMany({
      where: { id: input.listId, userId },
    });
  if (input.action === "bookmark") {
    const key = { userId, articleId: input.articleId };
    if (input.saved)
      await prisma.bookmark.upsert({
        where: { userId_articleId: key },
        create: key,
        update: {},
      });
    else await prisma.bookmark.deleteMany({ where: key });
  }
  if (input.action === "listItem") {
    const list = await prisma.readingList.findFirst({
      where: { id: input.listId, userId },
      select: { id: true, isPublic: true },
    });
    if (!list) return Response.json({ error: "List not found." }, { status: 404 });
    if (input.saved && list.isPublic && articleUnlisted)
      return Response.json({ error: "Unlisted stories can only be added to private collections." }, { status: 400 });
    const key = { listId: input.listId, articleId: input.articleId };
    if (input.saved)
      await prisma.readingListItem.upsert({
        where: { listId_articleId: key },
        create: key,
        update: {},
      });
    else await prisma.readingListItem.deleteMany({ where: key });
  }
  if (input.action === "saveList") {
    if (
      input.saved && !(await prisma.readingList.findFirst({
        where: { id: input.listId, isPublic: true },
        select: { id: true },
      }))
    )
      return Response.json({ error: "List not found." }, { status: 404 });
    const key = { userId, listId: input.listId };
    if (input.saved)
      await prisma.savedList.upsert({
        where: { userId_listId: key },
        create: key,
        update: {},
      });
    else await prisma.savedList.deleteMany({ where: key });
  }
  if (input.action === "highlight")
    await prisma.highlight.create({
      data: {
        userId,
        articleId: input.articleId,
        quote: input.quote,
        note: input.note,
      },
    });
  if (input.action === "deleteHighlight")
    await prisma.highlight.deleteMany({
      where: { id: input.highlightId, userId },
    });
  if (input.action === "clearHistory")
    await prisma.user.update({ where: { id: userId }, data: { readingHistoryClearedAt: new Date() } });
  return Response.json({ ok: true });
}
