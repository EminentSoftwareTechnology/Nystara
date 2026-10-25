import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GDPR Art. 15/20: machine-readable export of the caller's personal data.
// Credentials (passwordHash, OAuth tokens, session tokens) are deliberately excluded.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      name: true,
      username: true,
      bio: true,
      avatarUrl: true,
      image: true,
      createdAt: true,
      accounts: { select: { provider: true, providerAccountId: true } },
      articles: {
        select: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          contentText: true,
          published: true,
          memberOnly: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      comments: { select: { id: true, articleId: true, body: true, createdAt: true, deletedAt: true } },
      claps: { select: { articleId: true, count: true } },
      bookmarks: { select: { articleId: true, createdAt: true } },
      following: { select: { followingId: true, createdAt: true } },
      followers: { select: { followerId: true, createdAt: true } },
      subscription: {
        select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
      },
    },
  });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(
    { exportedAt: new Date().toISOString(), user: data },
    {
      headers: {
        "Content-Disposition": `attachment; filename="techscribe-export-${data.id}.json"`,
      },
    },
  );
}
