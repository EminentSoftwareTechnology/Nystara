import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import FeedTabs from "@/components/home/FeedTabs";

export const dynamic = "force-dynamic";

const articleSelect = {
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
} as const;

export default async function HomePage() {
  const [articles, featuredArticles, tags] = await Promise.all([
    prisma.article.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: articleSelect,
    }),
    prisma.article.findMany({
      where: { published: true },
      orderBy: { claps: { _count: "desc" } },
      take: 20,
      select: articleSelect,
    }),
    prisma.tag.findMany({
      take: 8,
      select: { name: true, slug: true },
    }),
  ]);

  const staffPicks = featuredArticles.slice(0, 3);

  return (
    <AppShell requireAuth={false}>
      <div className="max-w-6xl mx-auto px-6 py-8 flex gap-12">
        {/* Feed */}
        <div className="flex-1 min-w-0">
          <FeedTabs articles={articles} featured={featuredArticles} />
        </div>

        {/* Right sidebar */}
        <aside className="hidden lg:block w-80 flex-shrink-0 space-y-8">
          {/* Staff Picks */}
          {staffPicks.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Staff Picks</h3>
              <div className="space-y-5">
                {staffPicks.map((article) => {
                  const authorHandle = article.author.username ?? "";
                  const href = authorHandle ? `/${authorHandle}/${article.slug}` : "#";
                  return (
                    <div key={article.id}>
                      <div className="flex items-center gap-2 mb-1">
                        {article.author.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={article.author.avatarUrl}
                            alt={article.author.name ?? "Author"}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-700 flex-shrink-0" />
                        )}
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {article.author.name ?? article.author.username}
                        </span>
                      </div>
                      <Link href={href} className="block group">
                        <h4 className="text-sm font-bold leading-snug text-gray-900 dark:text-white group-hover:underline line-clamp-2">
                          {article.title}
                        </h4>
                      </Link>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {article.readTime} min read
                        {article.publishedAt && (
                          <>
                            {" · "}
                            {new Date(article.publishedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
              <Link
                href="/featured"
                className="block mt-4 text-sm text-green-600 hover:underline"
              >
                See the full list
              </Link>
            </section>
          )}

          <hr className="border-gray-200 dark:border-gray-800" />

          {/* Recommended topics */}
          {tags.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Recommended topics</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Link
                    key={tag.slug}
                    href={`/tag/${tag.slug}`}
                    className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
              <Link href="/topics" className="block mt-4 text-sm text-green-600 hover:underline">
                See more topics
              </Link>
            </section>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
