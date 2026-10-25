import { notifyUser } from "@/lib/email/notifications";
import { NextRequest, NextResponse } from "next/server";
import { coverImageUrl } from "@/lib/article-schema";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getVerifiedAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { MAX_CONTENT_CHARS, readJson } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getVerifiedAdminSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const article = await prisma.article.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      contentText: true,
      coverImage: true,
      readTime: true,
      published: true,
      memberOnly: true,
      publishedAt: true,
      createdAt: true,
      author: { select: { id: true, username: true, name: true } },
      tags: { select: { tag: { select: { slug: true, name: true } } } },
      _count: { select: { claps: true, comments: true, views: true } },
    },
  });

  if (!article)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(article);
}

const updateSchema = z.object({
  title: z.string().min(1).max(250).optional(),
  subtitle: z.string().max(500).optional(),
  coverImage: coverImageUrl.nullable().optional(),
  contentText: z.string().min(1).max(MAX_CONTENT_CHARS).optional(),
  memberOnly: z.boolean().optional(),
  published: z.boolean().optional(),
  tagSlugs: z.array(z.string().min(1).max(50)).max(5).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getVerifiedAdminSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await readJson(req);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );

  const { tagSlugs, contentText, published, ...rest } = parsed.data;

  const existing = await prisma.article.findUnique({
    where: { id },
    select: { published: true, authorId: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const wordCount = contentText
    ? contentText.trim().split(/\s+/).filter(Boolean).length
    : undefined;
  const readTime = wordCount
    ? Math.max(1, Math.ceil(wordCount / 200))
    : undefined;

  const article = await prisma.article.update({
    where: { id },
    data: {
      ...rest,
      ...(contentText
        ? {
            contentText,
            content: { text: contentText } as Prisma.InputJsonValue,
            readTime,
          }
        : {}),
      ...(published !== undefined
        ? {
            published,
            publishedAt: published
              ? !existing.published
                ? new Date()
                : undefined
              : null,
            submittedAt: null,
            scheduledAt: null,
            unlisted: false,
          }
        : {}),
      ...(tagSlugs !== undefined
        ? {
            tags: {
              deleteMany: {},
              create: [...new Set(tagSlugs)].map((tagSlug) => ({
                tag: {
                  connectOrCreate: {
                    where: { slug: tagSlug },
                    create: { slug: tagSlug, name: tagSlug },
                  },
                },
              })),
            },
          }
        : {}),
    },
    select: { id: true, slug: true, title: true, published: true },
  });

  if (published !== undefined && published !== existing.published) {
    await notifyUser(
      existing.authorId,
      published ? "story-published" : "story-unpublished",
    );
  }
  return NextResponse.json(article);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getVerifiedAdminSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.article.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.article.delete({ where: { id } });
  await notifyUser(existing.authorId, "story-deleted");
  return NextResponse.json({ ok: true });
}
