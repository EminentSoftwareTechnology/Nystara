import { publishDueStories } from "@/lib/story-status";
import { cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPaywallAccess, extractExcerpt } from "@/lib/paywall";
import { getPlan, PRO_PRICE } from "@/lib/pro";
import { hasPremiumAccess } from "@/lib/premium";
import {
  feedbackSummary,
  mostViewedToday,
  pageVoter,
  recordView,
  trendingArticles,
} from "@/lib/engagement";
import { commentSelect, toCommentView } from "@/lib/comments";
import { toStoryTheme } from "@/lib/story-theme";
import AppShell from "@/components/layout/AppShell";
import StoryContent from "@/components/article/StoryContent";
import { buttonClass } from "@/components/ui";
import ArticleHero from "@/components/article/ArticleHero";
import ShareBar from "@/components/article/ShareBar";
import ArticleFeedback from "@/components/article/ArticleFeedback";
import Comments from "@/components/article/Comments";
import TrendingRail from "@/components/article/TrendingRail";
import ArticleLibraryActions from "@/components/library/ArticleLibraryActions";
import FollowButton from "@/components/social/FollowButton";
import BackToTop from "@/components/article/BackToTop";
import ListenButton from "@/components/article/ListenButton";

type Props = {
  params: Promise<{ username: string; slug: string }>;
};

const loadArticle = cache(async (username: string, slug: string) => {
  await publishDueStories();
  const author = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!author) return null;
  const article = await prisma.article.findUnique({
    where: { authorId_slug: { authorId: author.id, slug } },
    select: {
      id: true,
      authorId: true,
      title: true,
      subtitle: true,
      coverImage: true,
      contentText: true,
      content: true,
      readTime: true,
      memberOnly: true,
      published: true,
      publishedAt: true,
      theme: true,
      author: {
        select: {
          username: true,
          name: true,
          avatarUrl: true,
          image: true,
          subscription: { select: { status: true, currentPeriodEnd: true } },
        },
      },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
    },
  });
  return article?.published ? article : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  if (!(await auth())?.user?.id) return { title: "Sign in to read", robots: { index: false } };
  const article = await loadArticle(username, slug);
  if (!article) return {};
  const description =
    article.subtitle ?? extractExcerpt(article.contentText).slice(0, 200);
  const images = article.coverImage ? [article.coverImage] : undefined;
  return {
    title: article.title,
    description,
    alternates: { canonical: `/${username}/${slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url: `/${username}/${slug}`,
      publishedTime: article.publishedAt?.toISOString(),
      authors: [article.author.name ?? username],
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: article.title,
      description,
      images,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { username, slug } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`)}`);
  const article = await loadArticle(username, slug);
  if (!article) notFound();

  const voter = await pageVoter(userId);
  if (!voter) notFound();

  let paywalled = false;
  const plan = await getPlan(userId);
  const subscriber = plan.pro;
  if (article.memberOnly && !subscriber) {
    // The free quota still applies to signed-in readers without a paid membership.
    const { allowed } = await checkPaywallAccess(voter.voterId, article.id);
    paywalled = !allowed;
  } else {
    await recordView(article.id, voter.voterId);
  }

  const [feedback, commentRows, trending, today, viewer] = await Promise.all([
    feedbackSummary(article.id, voter.voterId),
    prisma.comment.findMany({
      where: { articleId: article.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: commentSelect,
    }),
    trendingArticles(5),
    mostViewedToday(5),
    userId
      ? prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, username: true, avatarUrl: true, image: true },
        })
      : null,
  ]);
  const comments = commentRows.map((row) =>
    toCommentView(row, { userId: userId ?? null }),
  );
  const following = userId
    ? !!(await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: article.authorId,
          },
        },
        select: { followerId: true },
      }))
    : false;
  const shareUrl = new URL(
    `/${username}/${slug}`,
    process.env.NEXTAUTH_URL,
  ).toString();
  const theme = toStoryTheme(article.theme);

  return (
    <AppShell>
      <div className="story-theme" data-story-theme={theme}>
        <ArticleHero
          title={article.title}
          subtitle={article.subtitle}
          coverImage={article.coverImage}
          readTime={article.readTime}
          publishedAt={article.publishedAt}
          memberOnly={article.memberOnly}
          author={article.author}
          authorPro={hasPremiumAccess(article.author.subscription)}
          tags={article.tags.map(({ tag }) => tag)}
        />

        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <article className="mx-auto w-full min-w-0 max-w-[720px] xl:mx-0 xl:max-w-none">
            <div className="mb-8 border-b border-border pb-6">
              <ShareBar url={shareUrl} title={article.title} />
              <ArticleLibraryActions
                articleId={article.id}
                signedIn={!!userId}
              />
              {!paywalled && (
                <div className="mt-4">
                  <ListenButton pro={plan.pro} targetId="story-body" />
                </div>
              )}
              {userId !== article.authorId && (
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-sm text-muted">
                    Read more from{" "}
                    {article.author.name ?? article.author.username}
                  </span>
                  <FollowButton
                    writerId={article.authorId}
                    initialFollowing={following}
                  />
                </div>
              )}
            </div>

            <div id="story-body">
            <StoryContent
              content={paywalled ? null : article.content}
              text={
                paywalled
                  ? extractExcerpt(article.contentText)
                  : article.contentText
              }
            />
            </div>

            {paywalled && (
              <div className="mt-10 rounded-3xl border border-border bg-background px-6 py-10 text-center">
                <h2 className="mb-2 font-display text-3xl font-medium tracking-tight">
                  This story is for members only
                </h2>
                <p className="mb-6 text-muted">
                  You have read your five free member stories this month. Pro
                  members read every story, for {PRO_PRICE} a month.
                </p>
                <Link
                  href="/pricing"
                  className={buttonClass("primary", "lg")}
                >
                  Upgrade to Pro
                </Link>
              </div>
            )}

            <div className="mt-12 space-y-8">
              <ArticleFeedback
                articleId={article.id}
                initial={feedback}
                viewer={
                  viewer
                    ? {
                        name: viewer.name ?? viewer.username ?? "Reader",
                        avatarUrl: viewer.avatarUrl ?? viewer.image,
                      }
                    : null
                }
              />
              <div className="border-y border-border py-5">
                <ShareBar url={shareUrl} title={article.title} />
              </div>
              <Comments
                articleId={article.id}
                initial={comments}
                viewer={
                  viewer
                    ? {
                        name: viewer.name ?? viewer.username,
                        avatarUrl: viewer.avatarUrl ?? viewer.image,
                      }
                    : null
                }
              />
            </div>
          </article>

          <aside aria-label="More stories" className="min-w-0">
            <div className="xl:sticky xl:top-20">
              <TrendingRail trending={trending} today={today} />
            </div>
          </aside>
        </div>
      </div>
      <BackToTop />
    </AppShell>
  );
}
