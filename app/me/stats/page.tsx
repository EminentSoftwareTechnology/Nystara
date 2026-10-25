import { parsePage } from "@/lib/request";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { CARD, buttonClass } from "@/components/ui";
import { LineChart, BarChart, DonutChart } from "@/components/analytics/Charts";
import { publishDueStories } from "@/lib/story-status";
import {
  monthPoints,
  nextMilestone,
  weekdayPoints,
} from "@/lib/writer-insights";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; days?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const days = params.days === "7" ? 7 : params.days === "90" ? 90 : 30;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await publishDueStories();
  const userId = session.user.id;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const articleWhere = { authorId: userId, published: true };
  const today = new Date();
  const sixMonthsAgo = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1),
  );
  const [
    articles,
    totalArticles,
    daily,
    readers,
    comments,
    feedback,
    bookmarks,
    followers,
    topStories,
    states,
    claps,
    weekdays,
    monthly,
    totalFollowers,
  ] = await Promise.all([
    prisma.article.findMany({
      where: articleWhere,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 20,
      take: 20,
      select: {
        id: true,
        title: true,
        slug: true,
        author: { select: { username: true } },
        publishedAt: true,
        _count: {
          select: {
            views: { where: { createdAt: { gte: start } } },
            comments: { where: { deletedAt: null, createdAt: { gte: start } } },
            bookmarks: { where: { createdAt: { gte: start } } },
          },
        },
      },
    }),
    prisma.article.count({ where: articleWhere }),
    prisma.$queryRaw<
      { day: string; count: number }[]
    >`SELECT to_char(v."createdAt", 'YYYY-MM-DD') AS day, count(*)::int AS count FROM "ArticleView" v JOIN "Article" a ON a.id = v."articleId" WHERE a."authorId" = ${userId} AND a.published = true AND v."createdAt" >= ${start} GROUP BY day ORDER BY day`,
    prisma.$queryRaw<
      { count: number }[]
    >`SELECT count(DISTINCT v."visitorId")::int AS count FROM "ArticleView" v JOIN "Article" a ON a.id = v."articleId" WHERE a."authorId" = ${userId} AND a.published = true AND v."createdAt" >= ${start}`,
    prisma.comment.count({
      where: {
        article: articleWhere,
        deletedAt: null,
        createdAt: { gte: start },
      },
    }),
    prisma.articleFeedback.aggregate({
      where: {
        article: articleWhere,
        rating: { not: null },
        updatedAt: { gte: start },
      },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.bookmark.count({
      where: { article: articleWhere, createdAt: { gte: start } },
    }),
    prisma.follow.count({
      where: { followingId: userId, createdAt: { gte: start } },
    }),
    prisma.$queryRaw<
      { title: string; count: number }[]
    >`SELECT a.title, count(v.id)::int AS count FROM "Article" a LEFT JOIN "ArticleView" v ON v."articleId" = a.id AND v."createdAt" >= ${start} WHERE a."authorId" = ${userId} AND a.published = true GROUP BY a.id, a.title ORDER BY count DESC, a.title LIMIT 5`,
    prisma.article.groupBy({
      by: ["published", "unlisted"],
      where: { authorId: userId },
      _count: { _all: true },
    }),
    prisma.clap.aggregate({
      where: { article: articleWhere },
      _sum: { count: true },
    }),
    prisma.$queryRaw<
      { dow: number; count: number }[]
    >`SELECT extract(isodow FROM v."createdAt")::int AS dow, count(*)::int AS count FROM "ArticleView" v JOIN "Article" a ON a.id = v."articleId" WHERE a."authorId" = ${userId} AND a.published = true AND v."createdAt" >= ${start} GROUP BY dow`,
    prisma.$queryRaw<
      { month: string; count: number }[]
    >`SELECT to_char(a."publishedAt", 'YYYY-MM') AS month, count(*)::int AS count FROM "Article" a WHERE a."authorId" = ${userId} AND a.published = true AND a."publishedAt" >= ${sixMonthsAgo} GROUP BY month`,
    prisma.follow.count({ where: { followingId: userId } }),
  ]);
  const weekdayViews = weekdayPoints(weekdays);
  const bestDay = weekdayViews.reduce((best, day) =>
    day.value > best.value ? day : best,
  );
  const goal = nextMilestone(totalFollowers);
  const points = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      label: key,
      value: daily.find((row) => row.day === key)?.count ?? 0,
    };
  });
  const views = points.reduce((sum, point) => sum + point.value, 0);
  const metrics = [
    { label: "Views", value: views },
    { label: "Unique readers", value: readers[0]?.count ?? 0 },
    { label: "Responses", value: comments },
    { label: "Saved by readers", value: bookmarks },
    { label: "New followers", value: followers },
  ];
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Understand your impact</p>
            <h1 className="mt-1 font-display text-4xl">Writer stats</h1>
          </div>
          <Link href="/new-story" className={buttonClass()}>
            Write your next story
          </Link>
        </div>
        <nav
          aria-label="Analytics sections"
          className="mt-7 flex gap-6 border-b border-border text-sm"
        >
          <Link
            href="/me/stats"
            aria-current="page"
            className="border-b-2 border-foreground py-3 font-semibold"
          >
            Stories
          </Link>
          <Link href="/me/audience" className="py-3 text-muted">
            Audience
          </Link>
        </nav>
        <div className="my-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Last {days} days · UTC · Updated on each visit
          </p>
          <nav
            aria-label="Analytics period"
            className="flex rounded-full border border-border p-1"
          >
            {[7, 30, 90].map((value) => (
              <Link
                key={value}
                aria-current={value === days ? "page" : undefined}
                href={`/me/stats?days=${value}`}
                className={`rounded-full px-3 py-1.5 text-xs ${value === days ? "bg-accent text-accent-foreground" : "text-muted"}`}
              >
                {value} days
              </Link>
            ))}
          </nav>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {metrics.map((metric) => (
            <div key={metric.label} className={`${CARD} p-4`}>
              <p className="text-xs text-muted">{metric.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {metric.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        <LineChart title="Views over time" points={points} />
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <BarChart
            title="Most read stories this period"
            points={topStories.map((story) => ({
              label: story.title,
              value: story.count,
            }))}
          />
          <DonutChart
            title="Your writing portfolio · all time"
            points={[
              {
                label: "Published",
                value: states
                  .filter((row) => row.published && !row.unlisted)
                  .reduce((sum, row) => sum + row._count._all, 0),
              },
              {
                label: "Unlisted",
                value: states
                  .filter((row) => row.published && row.unlisted)
                  .reduce((sum, row) => sum + row._count._all, 0),
              },
              {
                label: "In progress",
                value: states
                  .filter((row) => !row.published)
                  .reduce((sum, row) => sum + row._count._all, 0),
              },
            ]}
          />
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <BarChart
              title="When your readers read"
              points={weekdayViews}
            />
            <p className="mt-2 px-1 text-xs text-muted">
              {bestDay.value
                ? `${bestDay.label} brings the most reads. Try publishing the day before.`
                : "Reading patterns appear once your stories get views."}
            </p>
          </div>
          <BarChart
            title="Publishing rhythm · stories per month"
            points={monthPoints(monthly, 6)}
          />
          <DonutChart
            title="How readers engaged this period"
            points={[
              { label: "Responses", value: comments },
              { label: "Saves", value: bookmarks },
              { label: "Ratings", value: feedback._count.rating },
              { label: "New followers", value: followers },
            ]}
          />
          <section className={`${CARD} flex flex-col justify-center p-5 sm:p-6`}>
            <h2 className="font-semibold">Next follower milestone</h2>
            <p className="mt-4 text-4xl font-semibold tabular-nums">
              {totalFollowers.toLocaleString()}
              <span className="text-lg font-normal text-muted">
                {" "}
                / {goal.toLocaleString()}
              </span>
            </p>
            <div
              role="progressbar"
              aria-label="Progress to next follower milestone"
              aria-valuemin={0}
              aria-valuemax={goal}
              aria-valuenow={totalFollowers}
              className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(totalFollowers / goal) * 100}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-muted">
              {(goal - totalFollowers).toLocaleString()} more to go. Every new
              story is another way for readers to find you.
            </p>
          </section>
        </div>
        <div
          className={`${CARD} my-5 flex flex-wrap justify-between gap-5 p-5`}
        >
          <div>
            <p className="text-sm font-semibold">Reader appreciation</p>
            <p className="mt-1 text-sm text-muted">
              {feedback._count.rating} ratings this period · Average{" "}
              {feedback._avg.rating?.toFixed(1) ?? "—"} / 5
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">
              {(claps._sum.count ?? 0).toLocaleString()} lifetime claps
            </p>
            <p className="mt-1 text-sm text-muted">
              Each reader can applaud more than once.
            </p>
          </div>
        </div>
        <section className="mt-8">
          <h2 className="font-display text-2xl">Story performance</h2>
          <p className="mt-1 text-xs text-muted">
            Views, responses and saves in the selected period. Views are counted
            once per reader per story per UTC day.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th scope="col" className="pb-3 font-medium">
                    Story
                  </th>
                  <th scope="col" className="pb-3 text-right font-medium">
                    Views
                  </th>
                  <th scope="col" className="pb-3 text-right font-medium">
                    Responses
                  </th>
                  <th scope="col" className="pb-3 text-right font-medium">
                    Saves
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {articles.map((article) => (
                  <tr key={article.id}>
                    <th scope="row" className="max-w-72 py-4 pr-4 font-normal">
                      <Link
                        href={
                          article.author.username
                            ? `/${article.author.username}/${article.slug}`
                            : `/editor/${article.id}`
                        }
                        className="font-medium hover:underline"
                      >
                        {article.title}
                      </Link>
                      <p className="mt-1 text-xs text-muted">
                        {article.publishedAt?.toLocaleDateString("en-GB")}
                      </p>
                    </th>
                    <td className="text-right">{article._count.views}</td>
                    <td className="text-right">{article._count.comments}</td>
                    <td className="text-right">{article._count.bookmarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!articles.length && (
            <p className="py-10 text-center text-sm text-muted">
              Publish your first story to start learning what connects with
              readers.
            </p>
          )}
        </section>
        <nav
          aria-label="Stats pages"
          className="mt-6 flex justify-between text-sm"
        >
          {page > 1 ? (
            <Link href={`/me/stats?days=${days}&page=${page - 1}`}>
              Previous page
            </Link>
          ) : (
            <span />
          )}
          {page * 20 < totalArticles && (
            <Link href={`/me/stats?days=${days}&page=${page + 1}`}>
              Next page
            </Link>
          )}
        </nav>
      </div>
    </AppShell>
  );
}
