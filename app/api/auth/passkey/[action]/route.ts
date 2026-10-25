import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { authenticationOptions, verifyPasskey } from "@/lib/mfa/passkeys";
import { authenticationResponse } from "@/lib/mfa/schemas";
import { readJson } from "@/lib/request";
import { startVerifiedSession } from "@/lib/user-session";

const verifySchema = z.object({ response: authenticationResponse });

/** Passwordless reader sign-in with a discoverable passkey. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;

  if (action === "options") {
    return NextResponse.json({ options: await authenticationOptions(null) });
  }

  if (action === "verify") {
    const parsed = verifySchema.safeParse(await readJson(req));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const userId = await verifyPasskey(parsed.data.response, null);
    if (!userId) {
      audit("passkey_login", "denied");
      return NextResponse.json({ error: "That passkey wasn’t recognised" }, { status: 401 });
    }
    await startVerifiedSession(userId);
    audit("passkey_login", "success");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
