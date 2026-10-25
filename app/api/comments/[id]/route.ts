import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Soft delete: replies stay attached and the thread keeps its shape.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const comment = await prisma.comment.findFirst({
    where: { id, deletedAt: null },
    select: { authorId: true },
  });
  if (!comment)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (comment.authorId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.comment.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return new NextResponse(null, { status: 204 });
}
