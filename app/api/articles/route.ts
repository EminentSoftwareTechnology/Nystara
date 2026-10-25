import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueSlug } from "@/lib/slug";
import { MAX_CONTENT_CHARS, readJson } from "@/lib/request";
import { articleContent, coverImageUrl } from "@/lib/article-schema";
import { documentText, storyNode } from "@/lib/story-document";
import { storyTheme } from "@/lib/story-theme";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tag = searchParams.get("tag") ?? undefined;
  const cursor = searchParams.get("cursor") ?? undefined;

  const articles = await prisma.article.findMany({
    where: {
      published: true,
      ...(tag ? { tags: { some: { tag: { slug: tag } } } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      coverImage: true,
      readTime: true,
      memberOnly: true,
      publishedAt: true,
      author: { select: { username: true, name: true, avatarUrl: true } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
      _count: { select: { claps: true, comments: true } },
    },
  });

  const hasMore = articles.length > PAGE_SIZE;
  const items = hasMore ? articles.slice(0, PAGE_SIZE) : articles;

  return NextResponse.json({
    articles: items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}

function normalizeTagSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const createSchema = z.object({
  title: z.string().min(1).max(250),
  subtitle: z.string().max(500).optional(),
  coverImage: coverImageUrl.nullable().optional(),
  content: articleContent,
  contentText: z.string().max(MAX_CONTENT_CHARS),
  memberOnly: z.boolean().default(false),
  theme: storyTheme.default("classic"),
  tagSlugs: z
    .array(
      z
        .string()
        .min(1)
        .max(50)
        .transform(normalizeTagSlug)
        .refine((s) => s.length > 0, "tag slug is empty after normalization"),
    )
    .max(5)
    .default([]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, subtitle, content, coverImage, memberOnly, theme, tagSlugs } =
    parsed.data;
  const doc = storyNode.safeParse(content);
  const contentText = doc.success && doc.data.content ? documentText(doc.data) : parsed.data.contentText;

  const wordCount = contentText.trim().split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  const slug = generateUniqueSlug(title);

  const article = await prisma.article.create({
    data: {
      slug,
      title,
      subtitle,
      coverImage,
      content: content as Prisma.InputJsonValue,
      contentText,
      readTime,
      memberOnly,
      theme,
      authorId: session.user.id,
      tags: {
        create: [...new Set(tagSlugs)].map((tagSlug) => ({
          tag: {
            connectOrCreate: {
              where: { slug: tagSlug },
              create: { slug: tagSlug, name: tagSlug },
            },
          },
        })),
      },
    },
    select: { id: true, slug: true, author: { select: { username: true } } },
  });

  return NextResponse.json(article, { status: 201 });
}
