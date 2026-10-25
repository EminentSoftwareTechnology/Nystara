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
    return Response.json(
      { error: "Sign in to follow writers." },
      { status: 401 },
    );
  const quota = await rateLimit(
    `writer-follow:${session.user.id}`,
    120,
    600_000,
  );
  if (!quota.ok)
    return Response.json(
      { error: "Too many changes. Please try again later." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfter) } },
    );
  const { id } = await params;
  if (id === session.user.id)
    return Response.json(
      { error: "You cannot follow yourself." },
      { status: 400 },
    );
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!target)
    return Response.json({ error: "Writer not found." }, { status: 404 });
  const key = { followerId: session.user.id, followingId: id };
  if (following)
    await prisma.follow.upsert({
      where: { followerId_followingId: key },
      create: key,
      update: {},
    });
  else await prisma.follow.deleteMany({ where: key });
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
