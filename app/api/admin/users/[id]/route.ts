import { notifyUser } from "@/lib/email/notifications";
import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { getVerifiedAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { eraseUser } from "@/lib/gdpr";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getVerifiedAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      role: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
      _count: { select: { articles: true, followers: true, following: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  bio: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getVerifiedAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await readJson(req);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (id === session.sub && parsed.data.role === "USER") {
    return NextResponse.json({ error: "Cannot remove your own admin role" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await prisma.user.update({
    where: { id },
    data: { ...parsed.data, ...(parsed.data.role ? { sessionVersion: { increment: 1 } } : {}) },
    select: { id: true, email: true, name: true, username: true, role: true, bio: true, avatarUrl: true, createdAt: true },
  });
  if (parsed.data.role && parsed.data.role !== existing.role) {
    audit("role_change", "success");
    await notifyUser(user.id, "role-changed", { detail: `Your account role is now ${user.role === "ADMIN" ? "administrator" : "reader"}.` });
  }
  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getVerifiedAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (id === session.sub) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await eraseUser(id, existing.email);
  return NextResponse.json({ ok: true });
}
