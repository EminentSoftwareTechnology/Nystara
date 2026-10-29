import { prisma } from "@/lib/prisma";
import { getVerifiedAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { monthlyActiveUsers } from "@/lib/admin-activity";
import { BarChart } from "@/components/analytics/Charts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getVerifiedAdminSession();
  if (!session) redirect("/admin/login");

  const [userCount, articleCount, publishedCount, activity] = await Promise.all([
    prisma.user.count({ where: { isSynthetic: false } }),
    prisma.article.count(),
    prisma.article.count({ where: { published: true } }),
    monthlyActiveUsers(),
  ]);

  const recentArticles = await prisma.article.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      published: true,
      createdAt: true,
      author: { select: { name: true, username: true } },
    },
  });

  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, name: true, email: true, createdAt: true, role: true },
  });

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-muted text-sm mt-1">
          Welcome back, {session?.email}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total users", value: userCount },
          { label: "Total articles", value: articleCount },
          { label: "Published articles", value: publishedCount },
          { label: "Monthly active users", value: activity[11].value },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-background rounded-2xl border border-border p-6"
          >
            <p className="text-sm text-muted">
              {stat.label}
            </p>
            <p className="text-3xl font-bold text-foreground mt-1">
              {stat.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <section aria-label="Monthly activity" className="mb-10">
        <p className="mb-4 text-sm text-muted">
          Unique signed-in users active in each calendar month (UTC). Excludes fictional newsroom profiles.
          Collection starts with this release; earlier months have no recorded activity.
        </p>
        <BarChart title="Monthly active users · last 12 months" points={activity} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent articles */}
        <div className="bg-background rounded-2xl border border-border p-6">
          <h2 className="font-semibold text-foreground mb-4">
            Recent articles
          </h2>
          <div className="space-y-3">
            {recentArticles.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {a.title}
                  </p>
                  <p className="text-xs text-muted">
                    {a.author.name ?? a.author.username} ·{" "}
                    {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    a.published
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-surface text-muted"
                  }`}
                >
                  {a.published ? "Live" : "Draft"}
                </span>
              </div>
            ))}
            {recentArticles.length === 0 && (
              <p className="text-sm text-muted">
                No articles yet.
              </p>
            )}
          </div>
        </div>

        {/* Recent users */}
        <div className="bg-background rounded-2xl border border-border p-6">
          <h2 className="font-semibold text-foreground mb-4">
            Recent users
          </h2>
          <div className="space-y-3">
            {recentUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {u.name ?? u.email}
                  </p>
                  <p className="text-xs text-muted">
                    {u.email}
                  </p>
                </div>
                {u.role === "ADMIN" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium shrink-0">
                    Admin
                  </span>
                )}
              </div>
            ))}
            {recentUsers.length === 0 && (
              <p className="text-sm text-muted">
                No users yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
