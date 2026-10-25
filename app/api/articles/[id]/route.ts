import { notifyUser } from "@/lib/email/notifications";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_CONTENT_CHARS, readJson } from "@/lib/request";
import { articleContent, coverImageUrl } from "@/lib/article-schema";
import { documentText, storyNode } from "@/lib/story-document";
import { storyTheme } from "@/lib/story-theme";

const updateSchema = z.object({
  title: z.string().min(1).max(250).optional(),
  subtitle: z.string().max(500).nullable().optional(),
  content: articleContent.optional(),
  contentText: z.string().max(MAX_CONTENT_CHARS).optional(),
  memberOnly: z.boolean().optional(),
  theme: storyTheme.optional(),
  coverImage: coverImageUrl.nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const article = await prisma.article.findUnique({
    where: { id },
    select: { authorId: true },
  });

  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (article.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await readJson(req);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { contentText: suppliedText, content, ...rest } = parsed.data;
  const doc = storyNode.safeParse(content);
  const contentText = doc.success && doc.data.content ? documentText(doc.data) : suppliedText;
  const contentUpdate =
    content !== undefined
      ? { content: content as Prisma.InputJsonValue }
      : {};
  const readTimeUpdate =
    contentText !== undefined
      ? {
          contentText,
          readTime: Math.max(
            1,
            Math.ceil(
              contentText.trim().split(/\s+/).filter(Boolean).length / 200,
            ),
          ),
        }
      : {};

  const updated = await prisma.article.update({
    where: { id },
    data: { ...rest, ...contentUpdate, ...readTimeUpdate },
    select: { id: true, slug: true, updatedAt: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const article = await prisma.article.findUnique({
    where: { id },
    select: { authorId: true },
  });

  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (article.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.article.delete({ where: { id } });
  await notifyUser(article.authorId, "story-deleted");
  return new NextResponse(null, { status: 204 });
}
