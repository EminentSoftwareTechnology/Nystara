import { NextResponse } from "next/server";
import { z } from "zod";
import { getVerifiedAdminSession } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { stripeConfig, stripeReady } from "@/lib/pro";

async function state() {
  const [setting, subscribers] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { id: "site" }, select: { proEnabled: true, updatedAt: true } }),
    prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] }, currentPeriodEnd: { gt: new Date() } } }),
  ]);
  return {
    proEnabled: setting?.proEnabled ?? false,
    updatedAt: setting?.updatedAt.toISOString() ?? null,
    stripe: stripeConfig(),
    subscribers,
  };
}

export async function GET() {
  if (!(await getVerifiedAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await state());
}

export async function PUT(req: Request) {
  if (!(await getVerifiedAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ proEnabled: z.boolean() }).safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Send proEnabled as true or false." }, { status: 400 });
  const { proEnabled } = parsed.data;
  if (proEnabled && !stripeReady()) {
    audit("pro_plan_change", "denied");
    return NextResponse.json({ error: "Set STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID and STRIPE_WEBHOOK_SECRET before launching Pro." }, { status: 409 });
  }
  await prisma.siteSetting.upsert({ where: { id: "site" }, create: { id: "site", proEnabled }, update: { proEnabled } });
  audit("pro_plan_change", "success");
  return NextResponse.json(await state());
}
