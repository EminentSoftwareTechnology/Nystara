import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/request";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
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
    select: { authorId: true, publishedAt: true },
  });

  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (article.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const text = await readBody(req);
  let body: unknown;
  try { body = text ? JSON.parse(text) as unknown : {}; }
  catch { return NextResponse.json({ error: "Invalid input" }, { status: 400 }); }
  const parsed = z.object({ published: z.boolean().default(true) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const published = parsed.data.published;
  const updated = await prisma.article.update({
    where: { id },
    data: {
      published,
      publishedAt: published ? article.publishedAt ?? new Date() : null,
    },
    select: { id: true, published: true, publishedAt: true },
  });

  return NextResponse.json(updated);
}
