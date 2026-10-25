import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAdminSession, setAdminSessionCookie } from "@/lib/admin-session";
import { verifyTurnstile } from "@/lib/turnstile";
import { readJson } from "@/lib/request";

const DUMMY_HASH = bcrypt.hashSync("timing-equalizer", 12);

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
  turnstileToken: z.string().min(1).max(4096),
});

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, password, turnstileToken } = parsed.data;

  const valid = await verifyTurnstile(turnstileToken);
  if (!valid) {
    return NextResponse.json({ error: "CAPTCHA verification failed" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, passwordHash: true, sessionVersion: true },
  });

  // Always run bcrypt so response time doesn't reveal whether the account exists.
  const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || user.role !== "ADMIN" || !user.passwordHash || !matches) {
    audit("admin_login", "denied");
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createAdminSession({ sub: user.id, email: user.email, role: user.role, version: user.sessionVersion });
  await setAdminSessionCookie(token);
  audit("admin_login", "success");

  return NextResponse.json({ ok: true });
}
