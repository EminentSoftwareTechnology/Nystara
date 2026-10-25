import { NextResponse } from "next/server";
import { authForAccountSetup } from "@/lib/auth";
import { securityStatus } from "@/lib/mfa";

export async function GET() {
  const session = await authForAccountSetup();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await securityStatus(session.user.id));
}
