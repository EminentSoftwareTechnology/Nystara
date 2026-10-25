import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authIncludingPendingMfa } from "@/lib/auth";
import { mfaMethods, verifyFactor } from "@/lib/mfa";
import { authenticationOptions } from "@/lib/mfa/passkeys";
import { proofSchema } from "@/lib/mfa/schemas";
import { readJson } from "@/lib/request";
import { markSessionMfaVerified } from "@/lib/user-session";

const verifySchema = z.object({ proof: proofSchema });

/** Second step of reader sign-in: the session exists but is held until a second factor is checked. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const session = await authIncludingPendingMfa();
  if (!session?.user?.id || !session.user.mfaPending) {
    return NextResponse.json({ error: "No sign-in waiting for verification" }, { status: 401 });
  }
  const userId = session.user.id;

  if (action === "options") {
    const methods = await mfaMethods(userId);
    return NextResponse.json({ methods, options: methods.passkey ? await authenticationOptions(userId) : null });
  }

  if (action === "verify") {
    const parsed = verifySchema.safeParse(await readJson(req));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    if (!(await verifyFactor(userId, parsed.data.proof))) {
      return NextResponse.json({ error: "That code or passkey wasn’t accepted" }, { status: 401 });
    }
    await markSessionMfaVerified();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
