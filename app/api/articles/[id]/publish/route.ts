import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
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
    select: { authorId: true, published: true },
  });

  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (article.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const toggled = !article.published;
  const updated = await prisma.article.update({
    where: { id },
    data: {
      published: toggled,
      publishedAt: toggled ? new Date() : null,
    },
    select: { id: true, published: true, publishedAt: true },
  });

  return NextResponse.json(updated);
}
