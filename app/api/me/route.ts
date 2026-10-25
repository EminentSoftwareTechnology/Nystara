import { notifyUser } from "@/lib/email/notifications";
import { NextResponse } from "next/server";
import { auth, authForAccountSetup } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { eraseUser } from "@/lib/gdpr";
import { z } from "zod";
import { readJson } from "@/lib/request";

export async function PATCH(req: Request) {
  const session = await authForAccountSetup();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = z.object({ name: z.string().trim().min(1).max(100), bio: z.string().trim().max(500).optional() }).safeParse(await readJson(req));
  if (!input.success) return NextResponse.json({ error: "Add a display name of up to 100 characters." }, { status: 400 });
  await prisma.user.update({ where: { id: session.user.id }, data: { name: input.data.name, bio: input.data.bio } });
  await notifyUser(session.user.id, "profile-updated");
  return NextResponse.json({ saved: true });
}

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
