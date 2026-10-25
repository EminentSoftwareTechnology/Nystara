import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPaywallAccess, extractExcerpt } from "@/lib/paywall";
import StoryContent from "@/components/article/StoryContent";
import AppShell from "@/components/layout/AppShell";
import { Avatar } from "@/components/layout/Avatar";
import { buttonClass } from "@/components/ui";

type Props = {
  params: Promise<{ username: string; slug: string }>;
};

export default async function ArticlePage({ params }: Props) {
  const { username, slug } = await params;

  const author = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!author) notFound();

  const article = await prisma.article.findUnique({
    where: { authorId_slug: { authorId: author.id, slug } },
    select: {
      id: true,
      title: true,
      subtitle: true,
      coverImage: true,
      contentText: true,
      content: true,
      readTime: true,
      memberOnly: true,
      published: true,
      publishedAt: true,
      author: { select: { username: true, name: true, avatarUrl: true } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
      _count: { select: { claps: true, comments: true } },
    },
  });

  if (!article || !article.published) notFound();

  let paywalled = false;

  if (article.memberOnly) {
    const session = await auth();

    if (session?.user?.id) {
      const sub = await prisma.subscription.findUnique({
        where: { userId: session.user.id },
        select: { status: true, currentPeriodEnd: true },
      });
      if ((sub?.status === "ACTIVE" || sub?.status === "TRIALING") && sub.currentPeriodEnd > new Date()) {
        paywalled = false;
      } else {
        // Logged-in non-members get the same free quota as anonymous visitors
        const visitorId = session.user.id;
        const { allowed } = await checkPaywallAccess(visitorId, article.id);
        paywalled = !allowed;
      }
    } else {
      const visitorId = (await headers()).get("x-reader-id");
      if (!visitorId) notFound();
      const { allowed } = await checkPaywallAccess(visitorId, article.id);
      paywalled = !allowed;
    }
  }

  const displayText = paywalled
    ? extractExcerpt(article.contentText)
    : article.contentText;

  return (
    <AppShell requireAuth={false}>
      <article className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        {article.coverImage && (
          // Cover images come from arbitrary user-supplied URLs; remotePatterns handles known hosts
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.coverImage}
            referrerPolicy="no-referrer"
            alt={article.title}
            className="mb-10 max-h-[28rem] w-full rounded-3xl border border-border object-cover"
          />
        )}

        <h1 className="mb-4 font-display text-4xl font-medium leading-[1.1] tracking-tight wrap-anywhere sm:text-5xl">{article.title}</h1>
        {article.subtitle && (
          <p className="mb-6 text-xl leading-8 text-muted">{article.subtitle}</p>
        )}

        <div className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-border py-4 text-sm text-muted">
          <Avatar src={article.author.avatarUrl} name={article.author.name ?? article.author.username ?? "Writer"} size={32} className="mr-1" />
          <Link
            href={`/${article.author.username}`}
            className="font-medium text-foreground hover:underline"
          >
            {article.author.name ?? article.author.username}
          </Link>
          <span>·</span>
          <span>{article.readTime} min read</span>
          {article.publishedAt && (
            <>
              <span>·</span>
              <span>
                {new Date(article.publishedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </>
          )}
          {article.memberOnly && (
            <span className="ml-1 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-foreground">
              Member
            </span>
          )}
        </div>

        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {article.tags.map(({ tag }) => (
              <Link
                key={tag.slug}
                href={`/tag/${tag.slug}`}
                className="rounded-full border border-border px-3 py-1 text-sm text-muted hover:text-foreground"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        )}

        <StoryContent content={paywalled ? null : article.content} text={displayText} />

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

        <div className="mt-10 flex items-center gap-4 border-t border-border pt-6 text-sm text-muted">
          <span>{article._count.claps} claps</span>
          <span>{article._count.comments} comments</span>
        </div>
      </article>
    </AppShell>
  );
}
