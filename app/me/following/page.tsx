import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/request";
import { publishDueStories } from "@/lib/story-status";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import ArticleCard from "@/components/article/ArticleCard";
import { Avatar } from "@/components/layout/Avatar";
import FollowButton from "@/components/social/FollowButton";
import TopicButton from "@/components/social/TopicButton";
import { buttonClass, INPUT, CARD } from "@/components/ui";

export const dynamic = "force-dynamic";
export default async function FollowingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await publishDueStories();
  const userId = session.user.id;
  const query = await searchParams;
  const tab = query.tab === "topics" ? "topics" : "writers";
  const q = (query.q ?? "").trim().slice(0, 100);
  const page = parsePage(query.page);
  const writerSelect = {
    id: true,
    username: true,
    name: true,
    avatarUrl: true,
    image: true,
  } as const;
  const [writers, otherWriters, topics, articles] = await Promise.all([
    tab === "writers"
      ? prisma.user.findMany({
          where: {
            followers: { some: { followerId: userId } },
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { username: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: { name: "asc" },
          take: 100,
          select: writerSelect,
        })
      : [],
    tab === "writers" && q
      ? prisma.user.findMany({
          where: {
            id: { not: userId },
            username: { not: null },
            followers: { none: { followerId: userId } },
            articles: { some: { published: true, unlisted: false } },
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { name: "asc" },
          take: 20,
          select: writerSelect,
        })
      : [],
    tab === "topics"
      ? prisma.tag.findMany({
          where: q ? { name: { contains: q, mode: "insensitive" } } : {},
          orderBy: { name: "asc" },
          take: 100,
          select: {
            id: true,
            name: true,
            slug: true,
            followers: { where: { userId }, select: { userId: true } },
            _count: {
              select: {
                articles: {
                  where: { article: { published: true, unlisted: false } },
                },
              },
            },
          },
        })
      : [],
    prisma.article.findMany({
      where: {
        published: true,
        unlisted: false,
        ...(tab === "topics"
          ? {
              tags: {
                some: {
                  tag: {
                    followers: { some: { userId } },
                    ...(q
                      ? { name: { contains: q, mode: "insensitive" } }
                      : {}),
                  },
                },
              },
            }
          : {
              author: {
                followers: { some: { followerId: userId } },
                ...(q
                  ? {
                      OR: [
                        { name: { contains: q, mode: "insensitive" } },
                        { username: { contains: q, mode: "insensitive" } },
                      ],
                    }
                  : {}),
              },
            }),
      },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * 20,
      take: 21,
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
          select: { username: true, name: true, avatarUrl: true, image: true },
        },
        tags: { select: { tag: { select: { name: true, slug: true } } } },
        _count: { select: { claps: true, comments: true } },
      },
    }),
  ]);
  function href(nextPage: number) {
    return `/me/following?${new URLSearchParams({ tab, q, page: String(nextPage) })}`;
  }
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              A feed that feels like you
            </p>
            <h1 className="mt-2 font-display text-4xl">Following</h1>
          </div>
          <Link
            href="/me/following/suggestions"
            className={buttonClass("secondary")}
          >
            Find writers
          </Link>
        </header>
        <nav
          aria-label="Following"
          className="mt-8 flex border-b border-border"
        >
          {[
            ["writers", "Writers"],
            ["topics", "Topics"],
          ].map(([id, label]) => (
            <Link
              key={id}
              href={`/me/following?tab=${id}`}
              aria-current={tab === id ? "page" : undefined}
              className={`border-b-2 px-4 py-3 text-sm ${tab === id ? "border-foreground font-semibold" : "border-transparent text-muted"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form className="my-6 flex gap-3">
          <input type="hidden" name="tab" value={tab} />
          <label className="sr-only" htmlFor="following-search">
            Search {tab}
          </label>
          <input
            id="following-search"
            name="q"
            defaultValue={q}
            placeholder={
              tab === "topics"
                ? "Find a topic to follow"
                : "Search writers by name or username"
            }
            className={INPUT}
          />
          <button className={buttonClass("secondary")}>Search</button>
        </form>
        {tab === "writers" && (
          <section className="mb-8 grid gap-3 sm:grid-cols-2">
            {writers.map((writer) => (
              <div
                key={writer.id}
                className={`${CARD} flex items-center gap-3 p-4`}
              >
                <Avatar
                  src={writer.avatarUrl ?? writer.image}
                  name={writer.name ?? writer.username ?? "Writer"}
                  size={40}
                />
                <Link
                  href={`/${writer.username}`}
                  className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline"
                >
                  {writer.name ?? writer.username}
                </Link>
                <FollowButton writerId={writer.id} initialFollowing />
              </div>
            ))}
            {q && !writers.length && (
              <p className="text-sm text-muted">
                You don&apos;t follow anyone matching &ldquo;{q}&rdquo;.
              </p>
            )}
          </section>
        )}
        {tab === "writers" && otherWriters.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold">
              More writers matching &ldquo;{q}&rdquo;
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {otherWriters.map((writer) => (
                <div
                  key={writer.id}
                  className={`${CARD} flex items-center gap-3 p-4`}
                >
                  <Avatar
                    src={writer.avatarUrl ?? writer.image}
                    name={writer.name ?? writer.username ?? "Writer"}
                    size={40}
                  />
                  <Link
                    href={`/${writer.username}`}
                    className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline"
                  >
                    {writer.name ?? writer.username}
                  </Link>
                  <FollowButton writerId={writer.id} />
                </div>
              ))}
            </div>
          </section>
        )}
        {tab === "topics" && (
          <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <div key={topic.id} className={`${CARD} p-5`}>
                <h2 className="font-semibold">{topic.name}</h2>
                <p className="mt-1 mb-4 text-xs text-muted">
                  {topic._count.articles} stories
                </p>
                <TopicButton
                  topicId={topic.id}
                  initialFollowing={topic.followers.length > 0}
                />
              </div>
            ))}
            {!topics.length && (
              <p className="text-sm text-muted">No matching topics.</p>
            )}
          </section>
        )}
        <h2 className="border-b border-border pb-3 text-sm font-semibold">
          Latest stories from{" "}
          {tab === "topics" ? "your topics" : "your writers"}
        </h2>
        {!articles.length ? (
          <div className="py-16 text-center">
            <h3 className="font-display text-2xl">
              Build a feed you look forward to
            </h3>
            <p className="mt-3 text-sm text-muted">
              {tab === "topics"
                ? "Follow a topic above to see its latest stories here."
                : "Find and follow writers to see their stories here."}
            </p>
            <Link
              href="/me/following/suggestions"
              className={buttonClass("secondary", "sm", "mt-5")}
            >
              Explore writers
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {articles.slice(0, 20).map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
        <nav aria-label="Following pages" className="mt-8 flex justify-between">
          <div>
            {page > 1 && (
              <Link
                href={href(page - 1)}
                className={buttonClass("secondary", "sm")}
              >
                Previous
              </Link>
            )}
          </div>
          {articles.length > 20 && (
            <Link
              href={href(page + 1)}
              className={buttonClass("secondary", "sm")}
            >
              Next
            </Link>
          )}
        </nav>
      </div>
    </AppShell>
  );
}
