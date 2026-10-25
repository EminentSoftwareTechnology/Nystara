import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/request";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { Avatar } from "@/components/layout/Avatar";
import { CARD, buttonClass } from "@/components/ui";
import { LineChart, DonutChart } from "@/components/analytics/Charts";

export const dynamic = "force-dynamic";

export default async function AudiencePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const page = parsePage((await searchParams).page);
  const userId = session.user.id;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 29);
  const [followers, newFollowers, following, people, daily, readership] =
    await Promise.all([
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.follow.count({
        where: { followingId: userId, createdAt: { gte: start } },
      }),
      prisma.follow.count({ where: { followerId: userId } }),
      prisma.follow.findMany({
        where: { followingId: userId },
        orderBy: [{ createdAt: "desc" }, { followerId: "asc" }],
        skip: (page - 1) * 20,
        take: 20,
        select: {
          createdAt: true,
          follower: {
            select: {
              id: true,
              username: true,
              name: true,
              bio: true,
              avatarUrl: true,
              image: true,
            },
          },
        },
      }),
      prisma.$queryRaw<
        { day: string; count: number }[]
      >`SELECT to_char("createdAt", 'YYYY-MM-DD') AS day, count(*)::int AS count FROM "Follow" WHERE "followingId" = ${userId} AND "createdAt" >= ${start} GROUP BY day ORDER BY day`,
      prisma.$queryRaw<
        { readers: number; returning: number }[]
      >`SELECT count(*)::int AS readers, count(*) FILTER (WHERE visits > 1)::int AS returning FROM (SELECT v."visitorId", count(DISTINCT v."createdAt"::date) AS visits FROM "ArticleView" v JOIN "Article" a ON a.id = v."articleId" WHERE a."authorId" = ${userId} AND a.published = true AND v."createdAt" >= ${start} GROUP BY v."visitorId") audience`,
    ]);
  const readers = readership[0]?.readers ?? 0;
  const returning = readership[0]?.returning ?? 0;
  const points = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      label: key,
      value: daily.find((row) => row.day === key)?.count ?? 0,
    };
  });
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <p className="text-sm text-muted">
          Build a community around your words
        </p>
        <h1 className="mt-1 font-display text-4xl">Your audience</h1>
        <nav
          aria-label="Analytics sections"
          className="mt-7 flex gap-6 border-b border-border text-sm"
        >
          <Link href="/me/stats" className="py-3 text-muted">
            Stories
          </Link>
          <Link
            href="/me/audience"
            aria-current="page"
            className="border-b-2 border-foreground py-3 font-semibold"
          >
            Audience
          </Link>
        </nav>
        <p className="my-6 text-sm text-muted">
          Updated on each visit · Reader activity from the last 30 days · UTC
        </p>
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Total followers",
              value: followers,
              note: "People following your writing",
            },
            {
              label: "New followers",
              value: newFollowers,
              note: "Current followers who joined in 30 days",
            },
            {
              label: "Unique readers",
              value: readers,
              note: "Signed-in and anonymous reader identities",
            },
            {
              label: "Returning readers",
              value: returning,
              note: "Read on at least two different UTC days",
            },
          ].map((metric) => (
            <div key={metric.label} className={`${CARD} p-4`}>
              <p className="text-xs text-muted">{metric.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {metric.value.toLocaleString()}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted">{metric.note}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <LineChart title="New followers over time" points={points} />
          <DonutChart
            title="Reader activity · last 30 days"
            points={[
              { label: "Read on one day", value: readers - returning },
              { label: "Returned on another day", value: returning },
            ]}
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          Anonymous readers are recognised by their browser identity. Follower
          history reflects people who still follow you. Email subscriber counts
          are not collected.
        </p>
        <section className="mt-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">People following you</h2>
              <p className="mt-1 text-sm text-muted">
                {followers} followers · You follow {following} writers
              </p>
            </div>
            <Link
              href="/me/following/suggestions"
              className={buttonClass("secondary", "sm")}
            >
              Find writers
            </Link>
          </div>
          <div className="mt-4 divide-y divide-border">
            {people.map(({ follower, createdAt }) => (
              <div key={follower.id} className="flex items-start gap-4 py-5">
                <Avatar
                  src={follower.avatarUrl ?? follower.image}
                  name={follower.name ?? follower.username ?? "Reader"}
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  {follower.username ? (
                    <Link
                      href={`/${follower.username}`}
                      className="font-medium hover:underline"
                    >
                      {follower.name ?? follower.username}
                    </Link>
                  ) : (
                    <p className="font-medium">{follower.name ?? "Reader"}</p>
                  )}
                  {follower.bio && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {follower.bio}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    Following since {createdAt.toLocaleDateString("en-GB")}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {!people.length && (
            <div className={`${CARD} mt-5 py-12 text-center`}>
              <h3 className="font-display text-2xl">
                Your community starts with a story
              </h3>
              <p className="mt-2 text-sm text-muted">
                Publish regularly and join conversations with writers you enjoy.
              </p>
              <Link
                href="/new-story"
                className={buttonClass("primary", "md", "mt-5")}
              >
                Write a story
              </Link>
            </div>
          )}
          <nav
            aria-label="Follower pages"
            className="mt-5 flex justify-between text-sm"
          >
            {page > 1 ? (
              <Link href={`/me/audience?page=${page - 1}`}>Previous page</Link>
            ) : (
              <span />
            )}
            {page * 20 < followers && (
              <Link href={`/me/audience?page=${page + 1}`}>Next page</Link>
            )}
          </nav>
        </section>
      </div>
    </AppShell>
  );
}
