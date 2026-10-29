import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isSynthetic: true } });
  if (!user || user.isSynthetic) return new NextResponse(null, { status: 204 });
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await prisma.userActivityDay.createMany({ data: [{ userId: session.user.id, day }], skipDuplicates: true });
  return new NextResponse(null, { status: 204 });
}
