import ProBadge from "@/components/billing/ProBadge";
import { hasPremiumAccess } from "@/lib/premium";
import { publishDueStories } from "@/lib/story-status";
import FollowButton from "@/components/social/FollowButton";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import ArticleCard from "@/components/article/ArticleCard";
import { Avatar } from "@/components/layout/Avatar";
import { buttonClass } from "@/components/ui";

type Props = {
  params: Promise<{ username: string }>;
};

export default async function ProfilePage({ params }: Props) {
  await publishDueStories();
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
        image: true,
        createdAt: true,
        subscription: { select: { status: true, currentPeriodEnd: true } },
        _count: { select: { followers: true, following: true } },
        articles: {
          where: { published: true, unlisted: false },
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
            author: {
              select: {
                username: true,
                name: true,
                avatarUrl: true,
                image: true,
              },
            },
            tags: { select: { tag: { select: { name: true, slug: true } } } },
            _count: { select: { claps: true, comments: true } },
          },
        },
      },
    }),
    auth(),
  ]);

  if (!profileUser) notFound();

  const following = session?.user?.id
    ? !!(await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: session.user.id,
            followingId: profileUser.id,
          },
        },
        select: { followerId: true },
      }))
    : false;
  const isOwnProfile = session?.user?.id === profileUser.id;

  const displayName = profileUser.name ?? profileUser.username ?? "Writer";

  return (
    <AppShell requireAuth={false}>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex flex-col gap-6 rounded-3xl border border-border bg-background p-6 sm:flex-row sm:items-center sm:p-8">
          <Avatar
            src={profileUser.avatarUrl ?? profileUser.image}
            name={displayName}
            size={88}
            className="text-3xl"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-medium tracking-tight wrap-anywhere sm:text-4xl">
              {displayName}
              {hasPremiumAccess(profileUser.subscription) && (
                <ProBadge className="ml-3 align-middle text-xs" />
              )}
            </h1>
            {profileUser.name && profileUser.username && (
              <p className="mt-1 truncate text-sm text-muted">
                @{profileUser.username}
              </p>
            )}
            {profileUser.bio && (
              <p className="mt-3 max-w-xl text-[15px] leading-7">
                {profileUser.bio}
              </p>
            )}
            <p className="mt-3 text-sm text-muted">
              <strong className="text-foreground">
                {profileUser._count.followers.toLocaleString()}
              </strong>{" "}
              followers ·{" "}
              <strong className="text-foreground">
                {profileUser._count.following.toLocaleString()}
              </strong>{" "}
              following · Joined{" "}
              {profileUser.createdAt.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          {isOwnProfile ? (
            <Link
              href="/settings"
              className={buttonClass(
                "secondary",
                "md",
                "self-start sm:self-center",
              )}
            >
              Edit profile
            </Link>
          ) : (
            <FollowButton
              writerId={profileUser.id}
              initialFollowing={following}
            />
          )}
        </header>

        <section aria-labelledby="profile-stories" className="mt-10">
          <h2
            id="profile-stories"
            className="border-b border-border pb-3 text-sm font-semibold"
          >
            Stories
          </h2>
          {profileUser.articles.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">
              No published stories yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {profileUser.articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
