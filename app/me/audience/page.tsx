import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default async function AudiencePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [followers, user] = await Promise.all([
    prisma.follow.count({ where: { followingId: session.user.id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { createdAt: true },
    }),
  ]);

  const joinDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "Account creation";

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Stats</h1>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-8">
          <Link
            href="/me/stats"
            className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 -mb-px transition-colors"
          >
            Stories
          </Link>
          <Link
            href="/me/audience"
            className="px-4 py-2.5 text-sm font-medium border-b-2 border-gray-900 dark:border-white text-gray-900 dark:text-white -mb-px"
          >
            Audience
          </Link>
        </div>

        {/* Lifetime header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Lifetime</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {joinDate} – Today (UTC) · Updated daily
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-12 mb-10">
          <div>
            <div className="text-5xl font-bold text-gray-900 dark:text-white">{followers.toLocaleString()}</div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-base text-gray-700 dark:text-gray-300">Followers</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">0 from last month</p>
          </div>
          <div>
            <div className="text-5xl font-bold text-gray-900 dark:text-white">0</div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-base text-gray-700 dark:text-gray-300">Email Subscribers</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">0 from last month</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
