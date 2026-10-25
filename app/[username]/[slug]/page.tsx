import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPaywallAccess, extractExcerpt } from "@/lib/paywall";
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
import BackToTop from "@/components/article/BackToTop";

type Props = {
  params: Promise<{ username: string; slug: string }>;
};

const loadArticle = cache(async (username: string, slug: string) => {
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
      author: { select: { username: true, name: true, avatarUrl: true } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
    },
  });
  return article?.published ? article : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const article = await loadArticle(username, slug);
  if (!article) return {};
  const description = article.subtitle ?? extractExcerpt(article.contentText).slice(0, 200);
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
  const article = await loadArticle(username, slug);
  if (!article) notFound();

  const session = await auth();
  const userId = session?.user?.id;
  const voter = await pageVoter(userId);
  if (!voter) notFound();

  let paywalled = false;
  let subscriber = false;
  if (article.memberOnly && userId) {
    const sub = await prisma.subscription.findUnique({
      where: { userId },
      select: { status: true, currentPeriodEnd: true },
    });
    subscriber =
      (sub?.status === "ACTIVE" || sub?.status === "TRIALING") && sub.currentPeriodEnd > new Date();
  }
  if (article.memberOnly && !subscriber) {
    // Logged-in non-members get the same free quota as anonymous visitors. The check also records the view.
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
      ? prisma.user.findUnique({ where: { id: userId }, select: { name: true, username: true } })
      : null,
  ]);
  const comments = commentRows.map((row) =>
    toCommentView(row, { userId: userId ?? null, articleAuthorId: article.authorId }),
  );
  const shareUrl = new URL(`/${username}/${slug}`, process.env.NEXTAUTH_URL).toString();
  const theme = toStoryTheme(article.theme);

  return (
    <AppShell requireAuth={false}>
      <div className="story-theme" data-story-theme={theme}>
        <ArticleHero
          title={article.title}
          subtitle={article.subtitle}
          coverImage={article.coverImage}
          readTime={article.readTime}
          publishedAt={article.publishedAt}
          memberOnly={article.memberOnly}
          author={article.author}
          tags={article.tags.map(({ tag }) => tag)}
        />

        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-10 sm:px-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <article className="mx-auto w-full min-w-0 max-w-[720px]">
            <div className="mb-8 border-b border-border pb-6">
              <ShareBar url={shareUrl} title={article.title} />
            </div>

            <StoryContent
              content={paywalled ? null : article.content}
              text={paywalled ? extractExcerpt(article.contentText) : article.contentText}
            />

            {paywalled && (
              <div className="mt-10 rounded-3xl border border-border bg-background px-6 py-10 text-center">
                <h2 className="mb-2 font-display text-3xl font-medium tracking-tight">
                  This story is for members only
                </h2>
                <p className="mb-6 text-muted">
                  Become a member to read the full story and support the author.
                </p>
                <Link
                  href="/subscribe"
                  className={buttonClass("primary", "lg")}
                >
                  Become a member
                </Link>
              </div>
            )}

            <div className="mt-12 space-y-8">
              <ArticleFeedback articleId={article.id} initial={feedback} />
              <div className="border-y border-border py-5">
                <ShareBar url={shareUrl} title={article.title} />
              </div>
              <Comments
                articleId={article.id}
                initial={comments}
                viewer={viewer ? { name: viewer.name ?? viewer.username } : null}
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
