import { NextResponse } from "next/server";
import { getVerifiedAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getVerifiedAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, username: true, avatarUrl: true, bio: true },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}
