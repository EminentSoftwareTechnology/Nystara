import { notifyUser } from "@/lib/email/notifications";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { getPlan } from "@/lib/pro";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["draft", "publish", "unlist", "submit"]) }),
  z.object({ action: z.literal("schedule"), scheduledAt: z.iso.datetime() }),
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose a valid story action." },
      { status: 400 },
    );
  if (parsed.data.action === "schedule" && !(await getPlan(session.user.id)).pro)
    return NextResponse.json(
      { error: "Scheduled publishing is part of Nystara Pro." },
      { status: 403 },
    );
  const { id } = await params;
  const article = await prisma.article.findFirst({
    where: { id, authorId: session.user.id },
    select: {
      contentText: true,
      title: true,
      publishedAt: true,
      published: true,
    },
  });
  if (!article)
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  const action = parsed.data.action;
  if (
    action !== "draft" &&
    (!article.title.trim() || !article.contentText.trim())
  )
    return NextResponse.json(
      { error: "Add a title and story text first." },
      { status: 400 },
    );
  const scheduledAt =
    parsed.data.action === "schedule"
      ? new Date(parsed.data.scheduledAt)
      : null;
  if (scheduledAt && scheduledAt.getTime() <= Date.now())
    return NextResponse.json(
      { error: "Choose a date and time in the future." },
      { status: 400 },
    );
  await prisma.article.updateMany({
    where: { id, authorId: session.user.id },
    data: {
      published: action === "publish" || action === "unlist",
      publishedAt:
        action === "publish" || action === "unlist"
          ? (article.publishedAt ?? new Date())
          : null,
      unlisted: action === "unlist",
      scheduledAt,
      submittedAt: action === "submit" ? new Date() : null,
    },
  });
  const published = action === "publish" || action === "unlist";
  if (article.published !== published) {
    await notifyUser(
      session.user.id,
      published ? "story-published" : "story-unpublished",
    );
  }
  return NextResponse.json({ ok: true });
}
