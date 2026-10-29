import { notifyUser } from "@/lib/email/notifications";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { currentVoter } from "@/lib/engagement";
import { commentInput, commentSelect, toCommentView } from "@/lib/comments";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const voter = await currentVoter();
  if (!voter?.userId)
    return NextResponse.json(
      { error: "Sign in to comment or review this article." },
      { status: 401 },
    );
  const input = commentInput.safeParse(await readJson(req));
  if (!input.success)
    return NextResponse.json(
      { error: input.error.issues[0]?.message ?? "Invalid comment." },
      { status: 400 },
    );
  const { body, parentId } = input.data;
  const quota = await rateLimit(`comment:${voter.voterId}`, 10, 3600_000);
  if (!quota.ok)
    return NextResponse.json(
      { error: "You're commenting too fast. Try again later." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfter) } },
    );

  const article = await prisma.article.findFirst({
    where: { id, published: true },
    select: { authorId: true, slug: true, author: { select: { username: true } } },
  });
  if (!article)
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  // Replies are one level deep, so a parent must be a live top-level comment on this story.
  let parentAuthorId: string | null = null;
  if (parentId) {
    const parent = await prisma.comment.findFirst({
      where: { id: parentId, articleId: id, parentId: null, deletedAt: null },
      select: { id: true, authorId: true },
    });
    if (!parent)
      return NextResponse.json(
        { error: "That comment is no longer available." },
        { status: 404 },
      );
    parentAuthorId = parent.authorId;
  }

  const comment = await prisma.comment.create({
    data: {
      body,
      articleId: id,
      parentId: parentId ?? null,
      authorId: voter.userId,
      guestName: null,
    },
    select: commentSelect,
  });
  const actionPath = article.author.username
    ? `/${encodeURIComponent(article.author.username)}/${encodeURIComponent(article.slug)}`
    : "/me/stories";
  const recipients = new Set<string>();
  if (parentAuthorId && parentAuthorId !== voter.userId) {
    recipients.add(parentAuthorId);
    await notifyUser(parentAuthorId, "reply-received", { actionPath });
  }
  if (article.authorId !== voter.userId && !recipients.has(article.authorId)) {
    await notifyUser(article.authorId, "comment-received", { actionPath });
  }
  return NextResponse.json(
    toCommentView(comment, { userId: voter.userId }),
    { status: 201 },
  );
}
