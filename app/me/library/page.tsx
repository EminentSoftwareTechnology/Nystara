import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      article: {
        select: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          readTime: true,
          coverImage: true,
          publishedAt: true,
          author: { select: { username: true, name: true, avatarUrl: true } },
        },
      },
    },
  });

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Your library</h1>
          <button className="px-4 py-2 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors">
            New list
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-8">
          {["Your lists", "Saved lists", "Highlights", "Reading history", "Responses"].map((tab, i) => (
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

        {/* Promo card */}
        <div className="rounded-xl bg-green-600 text-white p-6 flex items-center justify-between mb-6">
          <div>
            <p className="font-semibold text-lg leading-snug">
              Create a list to easily<br />organize and share stories
            </p>
            <button className="mt-4 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors">
              Start a list
            </button>
          </div>
          <div className="w-16 h-16 rounded-full border-2 border-white/50 flex items-center justify-center flex-shrink-0 ml-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              <line x1="12" y1="8" x2="12" y2="14" />
              <line x1="9" y1="11" x2="15" y2="11" />
            </svg>
          </div>
        </div>

        {/* Reading list */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-5 flex items-start justify-between">
            <div className="flex items-center gap-3">
              {session?.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="You" className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-700" />
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Reading list</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {bookmarks.length === 0 ? "No stories" : `${bookmarks.length} ${bookmarks.length === 1 ? "story" : "stories"}`}
                  {" "}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="inline-block text-gray-400">
                    <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM2 18a10 10 0 0 1 20 0H2z" />
                  </svg>
                </p>
              </div>
            </div>
            <button className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
              </svg>
            </button>
          </div>

          {bookmarks.length === 0 ? (
            <div className="px-5 pb-8 pt-2 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">No saved stories yet.</p>
            </div>
          ) : (
            <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {bookmarks.slice(0, 5).map(({ article }) => {
                const authorHandle = article.author.username ?? "";
                const href = authorHandle ? `/${authorHandle}/${article.slug}` : "#";
                return (
                  <div key={article.id} className="px-5 py-4">
                    <Link href={href} className="text-sm font-medium text-gray-900 dark:text-white hover:underline line-clamp-2">
                      {article.title}
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {article.author.name ?? article.author.username} · {article.readTime} min read
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
