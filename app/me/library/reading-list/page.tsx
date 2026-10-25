import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { Avatar } from "@/components/layout/Avatar";
import { LibraryMutationButton } from "@/components/library/LibraryControls";
import { parsePage } from "@/lib/request";
import { buttonClass } from "@/components/ui";
export default async function ReadingListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const page = parsePage((await searchParams).page);
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: session.user.id, article: { published: true } },
    orderBy: [{ createdAt: "desc" }, { articleId: "asc" }],
    skip: (page - 1) * 20,
    take: 21,
    select: {
      article: {
        select: {
          id: true,
          title: true,
          slug: true,
          readTime: true,
          author: {
            select: {
              name: true,
              username: true,
              avatarUrl: true,
              image: true,
            },
          },
        },
      },
    },
  });
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/me/library" className="text-sm text-muted hover:underline">
          ← Your library
        </Link>
        <h1 className="mt-6 font-display text-4xl">Reading list</h1>
        <p className="mt-3 text-sm text-muted">
          Every story you have saved, ready when you are.
        </p>
        <div className="mt-8 divide-y divide-border">
          {bookmarks.slice(0, 20).map(({ article }) => (
            <div key={article.id} className="flex justify-between gap-4 py-6">
              <div>
                <Link
                  href={`/${article.author.username}/${article.slug}`}
                  className="text-lg font-semibold hover:underline"
                >
                  {article.title}
                </Link>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                  <Avatar
                    src={article.author.avatarUrl ?? article.author.image}
                    name={article.author.name ?? "Writer"}
                    size={24}
                  />
                  <span>
                    {article.author.name ?? article.author.username} ·{" "}
                    {article.readTime} min read
                  </span>
                </div>
              </div>
              <LibraryMutationButton
                input={{
                  action: "bookmark",
                  articleId: article.id,
                  saved: false,
                }}
              >
                Remove
              </LibraryMutationButton>
            </div>
          ))}
        </div>
        {!bookmarks.length && (
          <p className="py-16 text-center text-muted">
            Save a story while reading to find it here.
          </p>
        )}
        <div className="mt-8 flex justify-between">
          <div>
            {page > 1 && (
              <Link
                href={`/me/library/reading-list?page=${page - 1}`}
                className={buttonClass("secondary", "sm")}
              >
                Previous
              </Link>
            )}
          </div>
          {bookmarks.length > 20 && (
            <Link
              href={`/me/library/reading-list?page=${page + 1}`}
              className={buttonClass("secondary", "sm")}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </AppShell>
  );
}
