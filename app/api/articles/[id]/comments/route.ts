import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { currentVoter } from "@/lib/engagement";
import { commentInput, commentSelect, toCommentView } from "@/lib/comments";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const voter = await currentVoter();
  if (!voter)
    return NextResponse.json(
      { error: "Reload the page and try again." },
      { status: 400 },
    );
  const input = commentInput.safeParse(await readJson(req));
  if (!input.success)
    return NextResponse.json(
      { error: input.error.issues[0]?.message ?? "Invalid comment." },
      { status: 400 },
    );
  const { body, guestName, parentId, turnstileToken } = input.data;
  if (!voter.userId) {
    if (!guestName)
      return NextResponse.json(
        { error: "Add your name to comment." },
        { status: 400 },
      );
    if (!turnstileToken || !(await verifyTurnstile(turnstileToken)))
      return NextResponse.json(
        { error: "Complete the verification and try again." },
        { status: 400 },
      );
  }
  const quota = await rateLimit(`comment:${voter.voterId}`, 10, 3600_000);
  if (!quota.ok)
    return NextResponse.json(
      { error: "You're commenting too fast. Try again later." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfter) } },
    );

  const article = await prisma.article.findFirst({
    where: { id, published: true },
    select: { authorId: true },
  });
  if (!article)
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  // Replies are one level deep, so a parent must be a live top-level comment on this story.
  if (parentId) {
    const parent = await prisma.comment.findFirst({
      where: { id: parentId, articleId: id, parentId: null, deletedAt: null },
      select: { id: true },
    });
    if (!parent)
      return NextResponse.json(
        { error: "That comment is no longer available." },
        { status: 404 },
      );
  }

  const comment = await prisma.comment.create({
    data: {
      body,
      articleId: id,
      parentId: parentId ?? null,
      authorId: voter.userId,
      guestName: voter.userId ? null : guestName,
    },
    select: commentSelect,
  });
  return NextResponse.json(
    toCommentView(comment, {
      userId: voter.userId,
      articleAuthorId: article.authorId,
    }),
    { status: 201 },
  );
}
