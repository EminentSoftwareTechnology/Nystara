import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/request";
import { publishDueStories } from "@/lib/story-status";
import AppShell from "@/components/layout/AppShell";
import { Avatar } from "@/components/layout/Avatar";
import FollowButton from "@/components/social/FollowButton";
import { buttonClass, INPUT, CARD } from "@/components/ui";

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    topic?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await publishDueStories();
  const query = await searchParams;
  const q = (query.q ?? "").trim().slice(0, 100);
  const topic = query.topic ?? "";
  const sort = query.sort === "newest" ? "newest" : "popular";
  const page = parsePage(query.page);
  const where: Prisma.UserWhereInput = {
    id: { not: session.user.id },
    username: { not: null },
    articles: {
      some: {
        published: true,
        unlisted: false,
        ...(topic ? { tags: { some: { tag: { slug: topic } } } } : {}),
      },
    },
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
            { bio: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [writers, total, topics] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy:
        sort === "newest"
          ? [{ createdAt: "desc" }, { id: "asc" }]
          : [{ followers: { _count: "desc" } }, { id: "asc" }],
      skip: (page - 1) * 12,
      take: 12,
      select: {
        id: true,
        username: true,
        name: true,
        bio: true,
        avatarUrl: true,
        image: true,
        followers: {
          where: { followerId: session.user.id },
          select: { followerId: true },
        },
        _count: {
          select: {
            followers: true,
            articles: { where: { published: true, unlisted: false } },
          },
        },
      },
    }),
    prisma.user.count({ where }),
    prisma.tag.findMany({
      orderBy: { name: "asc" },
      take: 100,
      select: { name: true, slug: true },
    }),
  ]);
  function href(nextPage: number) {
    return `/me/following/suggestions?${new URLSearchParams({ q, topic, sort, page: String(nextPage) })}`;
  }
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          Find your people
        </p>
        <h1 className="mt-2 font-display text-4xl">Discover writers</h1>
        <p className="mt-3 text-sm text-muted">
          Fresh perspectives. Familiar interests. Your next favourite writer.
        </p>
        <form
          className={`${CARD} mt-8 grid gap-3 p-4 sm:grid-cols-[1fr_180px_160px_auto]`}
        >
          <label className="sr-only" htmlFor="writer-search">
            Search writers
          </label>
          <input
            id="writer-search"
            name="q"
            defaultValue={q}
            className={INPUT}
            placeholder="Search name, username or interests"
          />
          <label className="sr-only" htmlFor="writer-topic">
            Filter by topic
          </label>
          <select
            id="writer-topic"
            name="topic"
            defaultValue={topic}
            className={INPUT}
          >
            <option value="">All topics</option>
            {topics.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="writer-sort">
            Sort writers
          </label>
          <select
            id="writer-sort"
            name="sort"
            defaultValue={sort}
            className={INPUT}
          >
            <option value="popular">Most followed</option>
            <option value="newest">Recently joined</option>
          </select>
          <button className={buttonClass()}>Find writers</button>
        </form>
        <p className="my-6 text-sm text-muted">
          {total} {total === 1 ? "writer" : "writers"} found
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {writers.map((writer) => (
            <section
              key={writer.id}
              className={`${CARD} flex items-start gap-4 p-5 sm:p-6`}
            >
              <Link
                href={`/${writer.username}`}
                aria-label={`Visit ${writer.name ?? writer.username}`}
              >
                <Avatar
                  src={writer.avatarUrl ?? writer.image}
                  name={writer.name ?? writer.username ?? "Writer"}
                  size={56}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/${writer.username}`}
                  className="text-lg font-semibold hover:underline"
                >
                  {writer.name ?? writer.username}
                </Link>
                <p className="text-xs text-muted">@{writer.username}</p>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">
                  {writer.bio ?? "Sharing ideas and stories on Nystara."}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-muted">
                    {writer._count.followers} followers ·{" "}
                    {writer._count.articles} stories
                  </span>
                  <FollowButton
                    writerId={writer.id}
                    initialFollowing={writer.followers.length > 0}
                  />
                </div>
              </div>
            </section>
          ))}
        </div>
        {!writers.length && (
          <p className="py-16 text-center text-muted">
            No writers match your search. Try a different name or topic.
          </p>
        )}
        <nav
          aria-label="Writer pages"
          className="mt-8 flex items-center justify-between"
        >
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
          <p className="text-sm text-muted">
            Page {page} of {Math.max(1, Math.ceil(total / 12))}
          </p>
          <div>
            {page * 12 < total && (
              <Link
                href={href(page + 1)}
                className={buttonClass("secondary", "sm")}
              >
                Next
              </Link>
            )}
          </div>
        </nav>
      </div>
    </AppShell>
  );
}
