import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";

export default async function SuggestionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const writers = await prisma.user.findMany({
    where: {
      id: { not: session.user.id },
      username: { not: null },
      articles: { some: { published: true } },
    },
    orderBy: { articles: { _count: "desc" } },
    take: 30,
    select: { id: true, username: true, name: true, bio: true },
  });
  return (
    <AppShell>
      <div className="w-full px-6 py-8">
        <h1 className="text-3xl font-semibold">Discover writers</h1>
        <p className="mt-2 mb-8 text-sm text-muted">
          Explore writers with published stories.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {writers.map((writer) => (
            <Link
              key={writer.id}
              href={`/${writer.username}`}
              className="rounded-xl border border-border p-6 hover:bg-background"
            >
              <h2 className="font-semibold">
                {writer.name ?? writer.username}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {writer.bio ?? `Read stories by ${writer.username}`}
              </p>
            </Link>
          ))}
        </div>
        {writers.length === 0 && (
          <p className="text-sm text-muted">
            Writers will appear here after publishing their first story.
          </p>
        )}
      </div>
    </AppShell>
  );
}
