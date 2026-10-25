import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import { legacyDocument, storyNode } from "@/lib/story-document";
import { toStoryTheme } from "@/lib/story-theme";
import StoryEditor from "@/app/new-story/StoryEditor";

export default async function EditStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const [article, user] = await Promise.all([
    prisma.article.findFirst({
      where: { id, authorId: session.user.id },
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        content: true,
        contentText: true,
        memberOnly: true,
        coverImage: true,
        theme: true,
        author: { select: { username: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        username: true,
        avatarUrl: true,
        subscription: { select: { status: true, currentPeriodEnd: true } },
      },
    }),
  ]);
  if (!article || !user) notFound();
  const doc = storyNode.safeParse(article.content);
  return (
    <StoryEditor
      name={user.name}
      email={session.user.email ?? null}
      avatarUrl={user.avatarUrl}
      username={user.username}
      premium={hasPremiumAccess(user.subscription)}
      initial={{
        ...article,
        theme: toStoryTheme(article.theme),
        content:
          doc.success && doc.data.content
            ? doc.data
            : legacyDocument(article.contentText),
      }}
    />
  );
}
