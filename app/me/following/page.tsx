import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import ArticleCard from "@/components/article/ArticleCard";

export const dynamic = "force-dynamic";

export default async function FollowingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const follows = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    select: { followingId: true },
  });

  const followingIds = follows.map((f) => f.followingId);

  const articles =
    followingIds.length > 0
      ? await prisma.article.findMany({
          where: { published: true, authorId: { in: followingIds } },
          orderBy: { publishedAt: "desc" },
          take: 20,
          select: {
            id: true,
            slug: true,
            title: true,
            subtitle: true,
            coverImage: true,
            readTime: true,
            memberOnly: true,
            publishedAt: true,
            author: { select: { username: true, name: true, avatarUrl: true } },
            tags: { select: { tag: { select: { name: true, slug: true } } } },
            _count: { select: { claps: true, comments: true } },
          },
        })
      : [];

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Following</h1>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-8">
          <button className="px-4 py-2.5 text-sm font-medium border-b-2 border-gray-900 dark:border-white text-gray-900 dark:text-white -mb-px">
            Writers and publications
          </button>
          <button className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 -mb-px transition-colors">
            Topics
          </button>
          <button className="px-3 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 -mb-px transition-colors">
            +
          </button>
        </div>

        {articles.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No followed writers</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Stories from writers you follow will be shown here.
            </p>
            <Link
              href="/me/following/suggestions"
              className="text-sm text-gray-700 dark:text-gray-300 underline hover:no-underline"
            >
              Find writers to follow
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
