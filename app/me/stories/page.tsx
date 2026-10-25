import { parsePage } from "@/lib/request";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { buttonClass, CARD } from "@/components/ui";
import { publishDueStories, STORY_TABS, storyTab } from "@/lib/story-status";
import StoryActions from "./StoryActions";

export const dynamic = "force-dynamic";

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const tab = storyTab(params.tab);
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await publishDueStories();
  const conditions = {
    drafts: { published: false, scheduledAt: null, submittedAt: null },
    scheduled: { published: false, scheduledAt: { not: null } },
    published: { published: true, unlisted: false },
    unlisted: { published: true, unlisted: true },
    submissions: { published: false, submittedAt: { not: null } },
  };
  const [articles, counts] = await Promise.all([
    prisma.article.findMany({
      where: { authorId: session.user.id, ...conditions[tab] },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 20,
      take: 21,
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        updatedAt: true,
        scheduledAt: true,
        publishedAt: true,
        readTime: true,
        author: { select: { username: true } },
        _count: {
          select: { views: true, comments: { where: { deletedAt: null } } },
        },
      },
    }),
    Promise.all(
      STORY_TABS.map((key) =>
        prisma.article.count({
          where: { authorId: session.user.id, ...conditions[key] },
        }),
      ),
    ),
  ]);
  const descriptions = {
    drafts: "Your next good idea starts here. Pick up where you left off.",
    scheduled: "Stories ready to meet readers at the time you choose.",
    published: "Your writing, out in the world.",
    unlisted: "Share a direct link with a smaller circle.",
    submissions:
      "Stories you've submitted for editorial review. They remain private until published.",
  };
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Your writing desk</p>
            <h1 className="mt-1 font-display text-4xl">Stories</h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/me/stories/import"
              className={buttonClass("secondary")}
            >
              Import story
            </Link>
            <Link href="/new-story" className={buttonClass()}>
              Write a story
            </Link>
          </div>
        </div>
        <nav
          aria-label="Story status"
          className="mb-6 flex gap-5 overflow-x-auto border-b border-border"
        >
          {STORY_TABS.map((key, index) => (
            <Link
              key={key}
              href={`/me/stories?tab=${key}`}
              aria-current={key === tab ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 py-3 text-sm capitalize ${key === tab ? "border-foreground font-semibold" : "border-transparent text-muted"}`}
            >
              {key}{" "}
              <span className="ml-1 text-xs text-muted">{counts[index]}</span>
            </Link>
          ))}
        </nav>
        <p className="mb-6 text-sm text-muted">{descriptions[tab]}</p>
        {articles.length ? (
          <div className="space-y-4">
            {articles.slice(0, 20).map((article) => (
              <article key={article.id} className={`${CARD} p-5 sm:p-6`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/editor/${article.id}`}
                      className="font-display text-2xl hover:underline"
                    >
                      {article.title}
                    </Link>
                    {article.subtitle && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted">
                        {article.subtitle}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
                      <span>{article.readTime} min read</span>
                      <span>
                        Edited {article.updatedAt.toLocaleDateString("en-GB")}
                      </span>
                      {article.scheduledAt && (
                        <span>
                          Publishes{" "}
                          {article.scheduledAt.toLocaleString("en-GB", {
                            timeZone: "UTC",
                          })}{" "}
                          UTC
                        </span>
                      )}
                      {article.publishedAt && (
                        <>
                          <span>{article._count.views} views</span>
                          <span>{article._count.comments} responses</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/editor/${article.id}`}
                    className={buttonClass("secondary", "sm")}
                  >
                    Edit
                  </Link>
                </div>
                <StoryActions id={article.id} tab={tab} />
                {article.publishedAt && article.author.username && (
                  <Link
                    href={`/${article.author.username}/${article.slug}`}
                    className="mt-3 inline-block text-sm underline"
                  >
                    View story
                  </Link>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className={`${CARD} py-16 text-center`}>
            <h2 className="font-display text-2xl">No {tab} yet</h2>
            <p className="mt-2 text-sm text-muted">
              Every story starts with a first sentence.
            </p>
            <Link
              href="/new-story"
              className={buttonClass("primary", "md", "mt-5")}
            >
              Start writing
            </Link>
          </div>
        )}
        <nav
          aria-label="Story pages"
          className="mt-8 flex justify-between text-sm"
        >
          {page > 1 ? (
            <Link href={`/me/stories?tab=${tab}&page=${page - 1}`}>
              Previous page
            </Link>
          ) : (
            <span />
          )}
          {articles.length > 20 && page < 1000 && (
            <Link href={`/me/stories?tab=${tab}&page=${page + 1}`}>
              Next page
            </Link>
          )}
        </nav>
      </div>
    </AppShell>
  );
}
