import { NextRequest, NextResponse } from "next/server";
import { getVerifiedAdminSession } from "@/lib/admin-auth";
import { handleSecurityAction, isSecurityAction } from "@/lib/mfa";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!isSecurityAction(action)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = await getVerifiedAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.sub }, select: { id: true, email: true, name: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await handleSecurityAction(action, user, await readJson(req));
  return NextResponse.json(result.body, { status: result.status });
}
