import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getVerifiedAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueSlug } from "@/lib/slug";
import { MAX_CONTENT_CHARS, parsePage, readJson } from "@/lib/request";

export async function GET(req: NextRequest) {
  const session = await getVerifiedAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const page = parsePage(searchParams.get("page"));
  const take = 20;
  const skip = (page - 1) * take;
  const search = searchParams.get("q")?.slice(0, 200) || undefined;
  const status = searchParams.get("status");

  const where = {
    ...(search
      ? { OR: [{ title: { contains: search, mode: "insensitive" as const } }] }
      : {}),
    ...(status === "published" ? { published: true } : status === "draft" ? { published: false } : {}),
  };

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        published: true,
        memberOnly: true,
        readTime: true,
        createdAt: true,
        publishedAt: true,
        author: { select: { username: true, name: true } },
        _count: { select: { claps: true, comments: true, views: true } },
      },
    }),
    prisma.article.count({ where }),
  ]);

  return NextResponse.json({ articles, total, page, pages: Math.ceil(total / take) });
}

const createSchema = z.object({
  title: z.string().min(1).max(250),
  subtitle: z.string().max(500).optional(),
  contentText: z.string().min(1).max(MAX_CONTENT_CHARS),
  memberOnly: z.boolean().default(false),
  published: z.boolean().default(false),
  tagSlugs: z.array(z.string().min(1).max(50)).max(5).default([]),
});

export async function POST(req: NextRequest) {
  const session = await getVerifiedAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { title, subtitle, contentText, memberOnly, published, tagSlugs } = parsed.data;
  const wordCount = contentText.trim().split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  const slug = await generateUniqueSlug(title, session.sub);

  const article = await prisma.article.create({
    data: {
      slug,
      title,
      subtitle,
      content: { text: contentText },
      contentText,
      readTime,
      memberOnly,
      published,
      publishedAt: published ? new Date() : null,
      authorId: session.sub,
      tags: {
        create: tagSlugs.map((tagSlug) => ({
          tag: {
            connectOrCreate: {
              where: { slug: tagSlug },
              create: { slug: tagSlug, name: tagSlug },
            },
          },
        })),
      },
    },
    select: { id: true, slug: true },
  });

  return NextResponse.json(article, { status: 201 });
}
