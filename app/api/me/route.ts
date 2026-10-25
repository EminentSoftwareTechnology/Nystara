import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eraseUser } from "@/lib/gdpr";

// Self-service account deletion.
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, role: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "ADMIN") {
    return NextResponse.json(
      { error: "Admin accounts must be removed by another admin" },
      { status: 400 },
    );
  }

  await eraseUser(session.user.id, user.email);
  return new NextResponse(null, { status: 204 });
}
