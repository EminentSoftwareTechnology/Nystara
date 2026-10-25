import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleSecurityAction, isSecurityAction } from "@/lib/mfa";
import { readJson } from "@/lib/request";
import { markSessionMfaVerified } from "@/lib/user-session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!isSecurityAction(action)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await handleSecurityAction(
    action,
    { id: session.user.id, email: session.user.email, name: session.user.name ?? null },
    await readJson(req),
  );
  // Turning MFA on must not lock out the session that just proved it; other sessions will be asked to verify.
  if (result.verified) await markSessionMfaVerified();
  return NextResponse.json(result.body, { status: result.status });
}
