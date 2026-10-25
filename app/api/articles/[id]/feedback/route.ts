import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { currentVoter, feedbackSummary } from "@/lib/engagement";

// Omitted fields stay unchanged; null clears a vote.
const schema = z
  .object({
    reaction: z.enum(["LIKE", "DISLIKE"]).nullable().optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
  })
  .refine((value) => value.reaction !== undefined || value.rating !== undefined);

export async function PUT(
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
  const input = schema.safeParse(await readJson(req));
  if (!input.success)
    return NextResponse.json({ error: "Invalid vote." }, { status: 400 });
  const quota = await rateLimit(`feedback:${voter.voterId}`, 60, 600_000);
  if (!quota.ok)
    return NextResponse.json(
      { error: "Too many votes. Try again later." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfter) } },
    );
  const article = await prisma.article.findFirst({
    where: { id, published: true },
    select: { id: true },
  });
  if (!article)
    return NextResponse.json({ error: "Story not found." }, { status: 404 });

  await prisma.articleFeedback.upsert({
    where: { articleId_voterId: { articleId: id, voterId: voter.voterId } },
    create: { articleId: id, voterId: voter.voterId, userId: voter.userId, ...input.data },
    update: input.data,
  });
  return NextResponse.json(await feedbackSummary(id, voter.voterId));
}
