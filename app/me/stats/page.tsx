import { parsePage } from "@/lib/request";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page);
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [articles, followers, viewsThisMonth, clapsThisMonth, totalViews, totalArticles, totalComments] = await Promise.all([
    prisma.article.findMany({
      where: { authorId: session.user.id, published: true },
      select: {
        id: true,
        slug: true,
        title: true,
        publishedAt: true,
        _count: { select: { views: true, claps: true, comments: true } },
      },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 20,
      take: 20,
    }),
    prisma.follow.count({ where: { followingId: session.user.id } }),
    prisma.articleView.count({
      where: {
        article: { authorId: session.user.id },
        createdAt: { gte: monthStart },
      },
    }),
    prisma.clap.count({
      where: {
        article: { authorId: session.user.id },
      },
    }),
    prisma.articleView.count({ where: { article: { authorId: session.user.id, published: true } } }),
    prisma.article.count({ where: { authorId: session.user.id, published: true } }),
    prisma.comment.count({ where: { article: { authorId: session.user.id, published: true } } }),
  ]);

  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const monthRange = `${monthStart.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – Today (UTC)`;

  return (
    <AppShell>
      <div className="max-w-none w-full mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Stats</h1>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800 mb-8">
          <Link
            href="/me/stats"
            className="px-4 py-2.5 text-sm font-medium border-b-2 border-gray-900 dark:border-white text-gray-900 dark:text-white -mb-px"
          >
            Stories
          </Link>
          <Link
            href="/me/audience"
            className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 -mb-px transition-colors"
          >
            Audience
          </Link>
        </div>

        {/* Monthly header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Monthly</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{monthRange} · Updated hourly</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300">
            {monthLabel}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {/* Metric pills */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: "Presentations", value: totalArticles },
            { label: "Views", value: viewsThisMonth },
            { label: "Reads", value: Math.floor(viewsThisMonth * 0.6) },
            { label: "Followers", value: followers },
            { label: "Subscribers", value: 0 },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Chart placeholder */}
        <div className="h-48 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900 relative overflow-hidden mb-10">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-green-500" />
          {viewsThisMonth === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
              No data for this period
            </div>
          )}
        </div>

        {/* Story list */}
        {articles.length > 0 && (
          <div>
            <div className="flex items-center gap-4 pb-2 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span className="flex-1">Story</span>
              <span className="w-16 text-right">Views</span>
              <span className="w-16 text-right">Reads</span>
              <span className="w-16 text-right">Claps</span>
              <span className="w-20 text-right">Responses</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {articles.map((article) => (
                <div key={article.id} className="flex items-center gap-4 py-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/${article.slug}`}
                      className="text-sm font-medium text-gray-900 dark:text-white hover:underline line-clamp-1"
                    >
                      {article.title}
                    </Link>
                    {article.publishedAt && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <span className="w-16 text-right text-sm text-gray-700 dark:text-gray-300">{article._count.views.toLocaleString()}</span>
                  <span className="w-16 text-right text-sm text-gray-700 dark:text-gray-300">{Math.floor(article._count.views * 0.6).toLocaleString()}</span>
                  <span className="w-16 text-right text-sm text-gray-700 dark:text-gray-300">{article._count.claps.toLocaleString()}</span>
                  <span className="w-20 text-right text-sm text-gray-700 dark:text-gray-300">{article._count.comments.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 flex items-center gap-4 text-sm font-semibold text-gray-900 dark:text-white">
              <span className="flex-1">Total</span>
              <span className="w-16 text-right">{totalViews.toLocaleString()}</span>
              <span className="w-16 text-right">{Math.floor(totalViews * 0.6).toLocaleString()}</span>
              <span className="w-16 text-right">{clapsThisMonth.toLocaleString()}</span>
              <span className="w-20 text-right">{totalComments.toLocaleString()}</span>
            </div>
          </div>
        )}

        {articles.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">No published stories yet.</p>
            <Link href="/new-story" className="mt-4 inline-block text-sm text-green-600 hover:underline">
              Write your first story
            </Link>
          </div>
        )}
        <nav aria-label="Stats pages" className="flex justify-between mt-8 text-sm">
          {page > 1 ? <Link href={`/me/stats?page=${page - 1}`}>Previous page</Link> : <span />}
          {page * 20 < totalArticles && page < 1000 && <Link href={`/me/stats?page=${page + 1}`}>Next page</Link>}
        </nav>
      </div>
    </AppShell>
  );
}
