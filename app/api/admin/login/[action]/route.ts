import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import {
  clearAdminMfaPending,
  createAdminSession,
  getAdminMfaPending,
  setAdminSessionCookie,
} from "@/lib/admin-session";
import { verifyFactor } from "@/lib/mfa";
import { authenticationOptions, verifyPasskey } from "@/lib/mfa/passkeys";
import { authenticationResponse, proofSchema } from "@/lib/mfa/schemas";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";

const mfaSchema = z.object({ proof: proofSchema });
const passkeySchema = z.object({ response: authenticationResponse });
const denied = () => NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

async function startAdminSession(userId: string, expectedVersion?: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, sessionVersion: true },
  });
  if (!user || user.role !== "ADMIN") return false;
  // The password step was for this session version; a password change or sign-out-everywhere since then voids it.
  if (expectedVersion !== undefined && user.sessionVersion !== expectedVersion) return false;
  await setAdminSessionCookie(
    await createAdminSession({ sub: user.id, email: user.email, role: user.role, version: user.sessionVersion }),
  );
  return true;
}

/**
 * - mfa-options / mfa: second step after the password, for admins with MFA on.
 * - passkey-options / passkey: passwordless admin sign-in with a discoverable passkey.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;

  if (action === "mfa-options") {
    const pending = await getAdminMfaPending();
    if (!pending) return denied();
    return NextResponse.json({ options: await authenticationOptions(pending.sub) });
  }

  if (action === "mfa") {
    const pending = await getAdminMfaPending();
    const parsed = mfaSchema.safeParse(await readJson(req));
    if (!pending) return denied();
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    if (!(await verifyFactor(pending.sub, parsed.data.proof)) || !(await startAdminSession(pending.sub, pending.version))) {
      audit("admin_login", "denied");
      return NextResponse.json({ error: "That code or passkey wasn’t accepted" }, { status: 401 });
    }
    await clearAdminMfaPending();
    audit("admin_login", "success");
    return NextResponse.json({ ok: true });
  }

  if (action === "passkey-options") {
    return NextResponse.json({ options: await authenticationOptions(null) });
  }

  if (action === "passkey") {
    const parsed = passkeySchema.safeParse(await readJson(req));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const userId = await verifyPasskey(parsed.data.response, null);
    if (!userId || !(await startAdminSession(userId))) {
      audit("admin_login", "denied");
      return denied();
    }
    audit("admin_login", "success");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
