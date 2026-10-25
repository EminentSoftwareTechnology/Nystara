import { rateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginWrite } from "@/lib/request";
async function change(
  req: Request,
  params: Promise<{ id: string }>,
  following: boolean,
) {
  if (!isSameOriginWrite(req))
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: "Sign in first." }, { status: 401 });
  const quota = await rateLimit(
    `topic-follow:${session.user.id}`,
    120,
    600_000,
  );
  if (!quota.ok)
    return Response.json(
      { error: "Too many changes. Please try again later." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfter) } },
    );
  const { id } = await params;
  if (!(await prisma.tag.findUnique({ where: { id }, select: { id: true } })))
    return Response.json({ error: "Topic not found." }, { status: 404 });
  const key = { userId: session.user.id, tagId: id };
  if (following)
    await prisma.topicFollow.upsert({
      where: { userId_tagId: key },
      create: key,
      update: {},
    });
  else await prisma.topicFollow.deleteMany({ where: key });
  return Response.json({ following });
}
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return change(req, params, true);
}
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return change(req, params, false);
}
