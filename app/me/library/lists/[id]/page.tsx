import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { Avatar } from "@/components/layout/Avatar";
import { LibraryMutationButton } from "@/components/library/LibraryControls";
import { parsePage } from "@/lib/request";
import { buttonClass } from "@/components/ui";
export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const page = parsePage((await searchParams).page);
  const list = await prisma.readingList.findFirst({
    where: { id, OR: [{ userId: session.user.id }, { isPublic: true }] },
    include: {
      user: {
        select: { name: true, username: true, avatarUrl: true, image: true },
      },
      saves: { where: { userId: session.user.id }, select: { userId: true } },
      items: {
        where: {
          article: { published: true },
          OR: [
            { article: { unlisted: false } },
            { list: { userId: session.user.id, isPublic: false } },
          ],
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * 20,
        take: 21,
        include: {
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
      },
    },
  });
  if (!list) notFound();
  const own = list.userId === session.user.id;
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/me/library" className="text-sm text-muted hover:underline">
          ← Your library
        </Link>
        <header className="mt-6 rounded-3xl border border-border bg-surface p-6 sm:p-8">
          <p className="text-xs uppercase tracking-widest text-muted">
            {list.isPublic ? "Public collection" : "Private collection"}
          </p>
          <h1 className="mt-3 font-display text-4xl">{list.name}</h1>
          {list.description && (
            <p className="mt-3 text-muted">{list.description}</p>
          )}
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Avatar
                src={list.user.avatarUrl ?? list.user.image}
                name={list.user.name ?? "Writer"}
                size={32}
              />
              <span className="text-sm">
                Curated by {list.user.name ?? list.user.username}
              </span>
            </div>
            {!own && (
              <LibraryMutationButton
                input={{
                  action: "saveList",
                  listId: id,
                  saved: !list.saves.length,
                }}
              >
                {list.saves.length ? "Unsave list" : "Save list"}
              </LibraryMutationButton>
            )}
          </div>
          {list.isPublic && (
            <p className="mt-4 text-xs text-muted">
              Share this page’s address to let other readers discover this
              collection.
            </p>
          )}
        </header>
        <div className="mt-6 divide-y divide-border">
          {list.items.slice(0, 20).map(({ article }) => (
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
              {own && (
                <LibraryMutationButton
                  input={{
                    action: "listItem",
                    articleId: article.id,
                    listId: id,
                    saved: false,
                  }}
                >
                  Remove
                </LibraryMutationButton>
              )}
            </div>
          ))}
        </div>
        {!list.items.length && (
          <p className="py-16 text-center text-muted">
            Open a story and use “Add to a list” to start collecting.
          </p>
        )}
        <div className="mt-8 flex justify-between">
          <div>
            {page > 1 && (
              <Link
                href={`/me/library/lists/${id}?page=${page - 1}`}
                className={buttonClass("secondary", "sm")}
              >
                Previous
              </Link>
            )}
          </div>
          {list.items.length > 20 && (
            <Link
              href={`/me/library/lists/${id}?page=${page + 1}`}
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
