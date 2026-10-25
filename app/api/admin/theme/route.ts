import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getVerifiedAdminSession } from "@/lib/admin-auth";
import { readJson } from "@/lib/request";
import { THEMES } from "@/lib/theme";

const schema = z.object({
  theme: z.enum(THEMES),
});

export async function POST(req: NextRequest) {
  const session = await getVerifiedAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid theme" }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("theme", parsed.data.theme, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
