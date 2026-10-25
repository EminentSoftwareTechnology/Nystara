import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import ArticleCard from "@/components/article/ArticleCard";

type Props = {
  params: Promise<{ username: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;

  const [profileUser, session] = await Promise.all([
    prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
        _count: { select: { followers: true, following: true } },
        articles: {
          where: { published: true },
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
        },
      },
    }),
    auth(),
  ]);

  if (!profileUser) notFound();

  const isOwnProfile = session?.user?.id === profileUser.id;

  return (
    <AppShell requireAuth={false}>
      <div className="max-w-5xl mx-auto px-6 py-8 flex gap-12">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {profileUser.name ?? profileUser.username}
          </h1>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mt-4 mb-6">
            {[
              { label: "Home", active: true },
              { label: "Activity", badge: true },
              { label: "About" },
            ].map(({ label, active, badge }) => (
              <button
                key={label}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active
                    ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {label}
                {badge && (
                  <span className="px-1.5 py-0.5 text-xs font-semibold bg-green-600 text-white rounded">New</span>
                )}
              </button>
            ))}
          </div>

          {/* Articles */}
          {profileUser.articles.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm">No published stories yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {profileUser.articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="hidden lg:flex flex-col items-center w-56 flex-shrink-0">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full overflow-hidden mb-3 bg-gray-200 dark:bg-gray-700 flex-shrink-0">
            {profileUser.avatarUrl ? (
              <Image
                src={profileUser.avatarUrl}
                alt={profileUser.name ?? profileUser.username ?? ""}
                width={80}
                height={80}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-500 dark:text-gray-400">
                {(profileUser.name ?? profileUser.username ?? "U")[0].toUpperCase()}
              </div>
            )}
          </div>

          <p className="font-semibold text-sm text-gray-900 dark:text-white text-center">
            {profileUser.name ?? profileUser.username}
          </p>

          {profileUser.bio && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center leading-relaxed">
              {profileUser.bio}
            </p>
          )}

          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {profileUser._count.followers.toLocaleString()} followers
          </p>

          {isOwnProfile ? (
            <Link
              href="/settings"
              className="mt-4 text-sm font-medium text-green-600 hover:underline"
            >
              Edit profile
            </Link>
          ) : (
            <button className="mt-4 px-5 py-2 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors">
              Follow
            </button>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
