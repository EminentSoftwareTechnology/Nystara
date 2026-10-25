import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default async function StoriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const articles = await prisma.article.findMany({
    where: { authorId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      published: true,
      memberOnly: true,
      publishedAt: true,
      updatedAt: true,
      readTime: true,
      _count: { select: { claps: true, comments: true, views: true } },
    },
  });

  const drafts = articles.filter((a) => !a.published);
  const published = articles.filter((a) => a.published);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Stories</h1>
          <Link
            href="#"
            className="px-4 py-2 rounded-full border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            Import a story
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-8">
          {["Drafts", "Scheduled", "Published", "Unlisted", "Submissions"].map((tab, i) => (
            <button
              key={tab}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                i === 0
                  ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Drafts */}
        {drafts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No stories in draft.</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Why not{" "}
              <Link href="/new-story" className="underline hover:no-underline">
                start writing one?
              </Link>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {drafts.map((article) => (
              <div key={article.id} className="py-5 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/editor/${article.id}`}
                    className="text-base font-semibold text-gray-900 dark:text-white hover:underline line-clamp-1"
                  >
                    {article.title || "Untitled"}
                  </Link>
                  {article.subtitle && (
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{article.subtitle}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Last edited{" "}
                    {new Date(article.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/editor/${article.id}`}
                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Published section */}
        {published.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Published</h2>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {published.map((article) => {
                return (
                  <div key={article.id} className="py-5 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/${article.slug}`}
                        className="text-base font-semibold text-gray-900 dark:text-white hover:underline line-clamp-1"
                      >
                        {article.title}
                      </Link>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>{article._count.views} views</span>
                        <span>{article._count.claps} claps</span>
                        <span>{article._count.comments} comments</span>
                        {article.memberOnly && (
                          <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs">Member</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {article.publishedAt && (
                        <span>
                          {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
