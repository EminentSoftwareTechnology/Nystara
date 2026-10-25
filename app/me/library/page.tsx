import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/request";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { Avatar } from "@/components/layout/Avatar";
import { buttonClass, CARD } from "@/components/ui";
import {
  LibraryMutationButton,
  NewListButton,
} from "@/components/library/LibraryControls";

const tabs = [
  ["lists", "Your lists"],
  ["saved", "Saved lists"],
  ["highlights", "Highlights"],
  ["history", "Reading history"],
  ["responses", "Responses"],
] as const;
const articleSelect = {
  id: true,
  slug: true,
  title: true,
  readTime: true,
  author: {
    select: { name: true, username: true, avatarUrl: true, image: true },
  },
} as const;
export const dynamic = "force-dynamic";
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const query = await searchParams;
  const tab = tabs.some(([id]) => id === query.tab) ? query.tab! : "lists";
  const page = parsePage(query.page);
  const paging = { skip: (page - 1) * 20, take: 21 };
  const historyClearedAt =
    tab === "history"
      ? (
          await prisma.user.findUnique({
            where: { id: userId },
            select: { readingHistoryClearedAt: true },
          })
        )?.readingHistoryClearedAt
      : null;
  const [lists, saved, bookmarks, highlights, history, responses] =
    await Promise.all([
      tab === "lists"
        ? prisma.readingList.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            ...paging,
            include: {
              _count: {
                select: {
                  items: {
                    where: {
                      article: { published: true },
                      OR: [
                        { article: { unlisted: false } },
                        { list: { userId, isPublic: false } },
                      ],
                    },
                  },
                },
              },
            },
          })
        : [],
      tab === "saved"
        ? prisma.savedList.findMany({
            where: { userId, list: { isPublic: true } },
            orderBy: { createdAt: "desc" },
            ...paging,
            include: {
              list: {
                include: {
                  _count: {
                    select: {
                      items: {
                        where: {
                          article: { published: true, unlisted: false },
                        },
                      },
                    },
                  },
                  user: { select: { name: true, username: true } },
                },
              },
            },
          })
        : [],
      tab === "lists" && page === 1
        ? prisma.bookmark.findMany({
            where: { userId, article: { published: true } },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { article: { select: articleSelect } },
          })
        : [],
      tab === "highlights"
        ? prisma.highlight.findMany({
            where: { userId, article: { published: true } },
            orderBy: { createdAt: "desc" },
            ...paging,
            include: { article: { select: articleSelect } },
          })
        : [],
      tab === "history"
        ? prisma.articleView.findMany({
            where: {
              visitorId: userId,
              article: { published: true },
              ...(historyClearedAt
                ? { createdAt: { gt: historyClearedAt } }
                : {}),
            },
            orderBy: { createdAt: "desc" },
            ...paging,
            include: { article: { select: articleSelect } },
          })
        : [],
      tab === "responses"
        ? prisma.comment.findMany({
            where: {
              authorId: userId,
              deletedAt: null,
              article: { published: true },
            },
            orderBy: { createdAt: "desc" },
            ...paging,
            include: { article: { select: articleSelect } },
          })
        : [],
    ]);
  const rows =
    tab === "lists"
      ? lists
      : tab === "saved"
        ? saved
        : tab === "highlights"
          ? highlights
          : tab === "history"
            ? history
            : responses;
  function story(article: (typeof bookmarks)[number]["article"]) {
    const name = article.author.name ?? article.author.username ?? "Writer";
    return (
      <div className="min-w-0">
        <Link
          href={`/${article.author.username}/${article.slug}`}
          className="font-semibold hover:underline"
        >
          {article.title}
        </Link>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          <Avatar
            src={article.author.avatarUrl ?? article.author.image}
            name={name}
            size={24}
          />
          <span>
            {name} · {article.readTime} min read
          </span>
        </div>
      </div>
    );
  }
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              Your space to collect
            </p>
            <h1 className="mt-2 font-display text-4xl">Your library</h1>
            <p className="mt-3 text-sm text-muted">
              Keep the stories, passages and conversations that stay with you.
            </p>
          </div>
          <NewListButton />
        </header>
        <nav
          aria-label="Library"
          className="mt-8 mb-8 flex overflow-x-auto border-b border-border"
        >
          {tabs.map(([id, label]) => (
            <Link
              key={id}
              href={`/me/library?tab=${id}`}
              aria-current={tab === id ? "page" : undefined}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm ${tab === id ? "border-foreground font-semibold" : "border-transparent text-muted"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        {tab === "lists" && (
          <>
            <div className="mb-6 rounded-2xl bg-accent p-6 text-accent-foreground">
              <h2 className="font-display text-2xl">
                A shelf for every curiosity.
              </h2>
              <p className="mt-2 max-w-lg text-sm opacity-80">
                Save a story while reading, then add it to a list. Share public
                lists with readers who love what you love.
              </p>
            </div>
            {page === 1 && (
              <section className={`${CARD} mb-6 p-6`}>
                <Link
                  href="/me/library/reading-list"
                  className="text-lg font-semibold hover:underline"
                >
                  Reading list
                </Link>
                <p className="mt-1 text-sm text-muted">
                  Your recently saved stories
                </p>
                <div className="mt-4 divide-y divide-border">
                  {bookmarks.map(({ article }) => (
                    <div
                      key={article.id}
                      className="flex justify-between gap-4 py-4"
                    >
                      {story(article)}
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
                  <p className="mt-4 text-sm text-muted">
                    Save your first story using “Save story” on an article.
                  </p>
                )}
                <Link
                  href="/me/library/reading-list"
                  className="mt-4 inline-block text-sm underline underline-offset-4"
                >
                  View all saved stories
                </Link>
              </section>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {lists.slice(0, 20).map((list) => (
                <section key={list.id} className={`${CARD} p-6`}>
                  <p className="text-xs text-muted">
                    {list.isPublic ? "Public collection" : "Private collection"}
                  </p>
                  <Link
                    href={`/me/library/lists/${list.id}`}
                    className="mt-3 block font-display text-2xl hover:underline"
                  >
                    {list.name}
                  </Link>
                  <p className="mt-2 text-sm text-muted">
                    {list.description ??
                      "A collection of stories worth keeping."}
                  </p>
                  <div className="mt-6 flex items-center justify-between gap-3">
                    <span className="text-sm text-muted">
                      {list._count.items} stories
                    </span>
                    <LibraryMutationButton
                      input={{ action: "deleteList", listId: list.id }}
                    >
                      Delete list
                    </LibraryMutationButton>
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
        {tab === "saved" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {saved.slice(0, 20).map(({ list }) => (
              <section key={list.id} className={`${CARD} p-6`}>
                <Link
                  href={`/me/library/lists/${list.id}`}
                  className="font-display text-2xl hover:underline"
                >
                  {list.name}
                </Link>
                <p className="mt-2 text-sm text-muted">
                  By {list.user.name ?? list.user.username} ·{" "}
                  {list._count.items} stories
                </p>
                <div className="mt-4">
                  <LibraryMutationButton
                    input={{
                      action: "saveList",
                      listId: list.id,
                      saved: false,
                    }}
                  >
                    Unsave list
                  </LibraryMutationButton>
                </div>
              </section>
            ))}
          </div>
        )}
        {tab === "highlights" && (
          <div className="space-y-4">
            {highlights.slice(0, 20).map((item) => (
              <section key={item.id} className={`${CARD} p-6`}>
                <blockquote className="border-l-2 border-accent pl-4 font-display text-xl leading-relaxed">
                  {item.quote}
                </blockquote>
                {item.note && (
                  <p className="mt-3 text-sm text-muted">{item.note}</p>
                )}
                <div className="mt-6 flex justify-between gap-4">
                  {story(item.article)}
                  <LibraryMutationButton
                    input={{ action: "deleteHighlight", highlightId: item.id }}
                  >
                    Remove
                  </LibraryMutationButton>
                </div>
              </section>
            ))}
          </div>
        )}
        {tab === "history" && (
          <>
            <div className="mb-6 flex justify-between gap-4">
              <p className="text-sm text-muted">
                Stories you have opened while signed in. Each visit is recorded
                once per day.
              </p>
              <LibraryMutationButton input={{ action: "clearHistory" }}>
                Clear history
              </LibraryMutationButton>
            </div>
            <div className="divide-y divide-border">
              {history.slice(0, 20).map((item) => (
                <div key={item.id} className="flex justify-between gap-4 py-5">
                  {story(item.article)}
                  <time className="shrink-0 text-xs text-muted">
                    {item.createdAt.toLocaleDateString("en-GB")}
                  </time>
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "responses" && (
          <div className="space-y-4">
            {responses.slice(0, 20).map((item) => (
              <section key={item.id} className={`${CARD} p-6`}>
                {story(item.article)}
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
                  {item.body}
                </p>
                <p className="mt-3 text-xs text-muted">
                  {item.createdAt.toLocaleDateString("en-GB")}
                </p>
              </section>
            ))}
          </div>
        )}
        {rows.length === 0 && tab !== "lists" && (
          <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <h2 className="font-display text-2xl">
              Your next discovery belongs here
            </h2>
            <p className="mt-3 text-sm text-muted">
              {tab === "saved"
                ? "Open a public list shared by a writer and save it to your library."
                : tab === "highlights"
                  ? "Select a passage in a story and save a highlight."
                  : tab === "history"
                    ? "Stories you read while signed in will appear here."
                    : "Join a story’s conversation to see your responses here."}
            </p>
            <Link href="/" className={buttonClass("secondary", "sm", "mt-5")}>
              Explore stories
            </Link>
          </div>
        )}
        <div className="mt-8 flex justify-between">
          {page > 1 ? (
            <Link
              href={`/me/library?tab=${tab}&page=${page - 1}`}
              className={buttonClass("secondary", "sm")}
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          {rows.length > 20 && (
            <Link
              href={`/me/library?tab=${tab}&page=${page + 1}`}
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
