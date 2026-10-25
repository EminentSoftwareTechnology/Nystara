import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { DIGEST_FREQUENCIES, setMemberDigest } from "@/lib/digest";

const schema = z.object({ emailTheme: z.enum(["light", "dark", "sand"]), activityEmails: z.boolean(), digest: z.enum([...DIGEST_FREQUENCIES, "OFF"]).optional() });

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid email theme and activity preference." }, { status: 400 });
  const { digest, ...preferences } = parsed.data;
  await prisma.user.update({ where: { id: session.user.id }, data: preferences });
  if (digest) await setMemberDigest(session.user.id, digest === "OFF" ? null : digest);
  return NextResponse.json({ saved: true });
}
