import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import FeedTabs from "@/components/home/FeedTabs";
import { Wordmark } from "@/components/brand/Logo";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { Heading } from "@/components/marketing/Heading";
import { Wall } from "@/components/marketing/Wall";
import { WRITER_FEATURES } from "@/components/marketing/features";
import { CARD, LEARN, SECTION, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const articleSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  coverImage: true,
  readTime: true,
  memberOnly: true,
  publishedAt: true,
  author: { select: { username: true, name: true, avatarUrl: true } },
  tags: { select: { tag: { select: { name: true, slug: true } } } },
  _count: { select: { claps: true, comments: true } },
} as const;

const REASONS = [
  "Think more clearly by writing it down",
  "Build a body of work people can find",
  "Earn trust long before you ask for anything",
];

function storyHref(article: { slug: string; author: { username: string | null } }) {
  return article.author.username ? `/${article.author.username}/${article.slug}` : "#";
}

function shortDate(date: Date | null) {
  return date ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
}

export default async function HomePage() {
  const [session, articles, featuredArticles, tags] = await Promise.all([
    auth(),
    prisma.article.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: articleSelect,
    }),
    prisma.article.findMany({
      where: { published: true },
      orderBy: { claps: { _count: "desc" } },
      take: 20,
      select: articleSelect,
    }),
    prisma.tag.findMany({
      take: 10,
      select: { name: true, slug: true },
    }),
  ]);

  const [lead, ...picks] = featuredArticles;
  const staffPicks = picks.slice(0, 3);
  const writeHref = session?.user?.id ? "/new-story" : "/signup";

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-6 pt-12 sm:px-6 sm:pt-20">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Nystara is a home for writing that lasts.{" "}
          <span className="font-medium text-muted">
            Read deep dives from people who build things, then publish your own and grow an audience.
          </span>
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="#latest" className={buttonClass("primary", "md")}>
            Start reading <ArrowRightIcon size={16} />
          </Link>
          <Link href={writeHref} className={buttonClass("secondary", "md")}>
            Start writing
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted">
          Free to join · 5 member-only stories free every 30 days · No password to remember
        </p>

        <Wall id="hero-wall" variant={0} className="mt-10 px-3 py-8 sm:px-10 sm:py-14">
          {lead ? (
            <Link
              href={storyHref(lead)}
              className="group mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-page/95 p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)] backdrop-blur sm:p-8"
            >
              <span className="text-xs font-medium uppercase tracking-wider text-muted">Featured story</span>
              <span className="text-2xl font-semibold tracking-tight text-balance group-hover:underline sm:text-3xl">
                {lead.title}
              </span>
              {lead.subtitle && <span className="leading-7 text-muted line-clamp-2">{lead.subtitle}</span>}
              <span className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                <span className="font-medium text-foreground">{lead.author.name ?? lead.author.username}</span>
                <span aria-hidden>·</span>
                <span>{lead.readTime} min read</span>
                {lead.publishedAt && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{shortDate(lead.publishedAt)}</span>
                  </>
                )}
              </span>
            </Link>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-3 rounded-2xl border border-border bg-page/95 p-6 sm:p-8">
              <span className="text-xs font-medium uppercase tracking-wider text-muted">Be the first</span>
              <span className="text-2xl font-semibold tracking-tight sm:text-3xl">No stories yet. Yours could be the first.</span>
              <Link href={writeHref} className={buttonClass("primary", "md", "mt-2")}>
                Write a story <ArrowRightIcon size={16} />
              </Link>
            </div>
          )}
        </Wall>
      </section>

      {/* Topics */}
      {tags.length > 0 && (
        <section aria-labelledby="topics" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <h2 id="topics" className="mb-5 text-center text-sm text-muted">
            Explore what people are writing about
          </h2>
          <ul className="flex flex-wrap justify-center gap-2">
            {tags.map((tag) => (
              <li key={tag.slug} className="rounded-full border border-border bg-background px-3.5 py-1.5 text-sm">
                {tag.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Latest stories */}
      <section id="latest" aria-labelledby="latest-heading" className={`${SECTION} scroll-mt-20`}>
        <Heading eyebrow="The blog" id="latest-heading" title="Latest stories" />
        <div className="grid gap-12 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <FeedTabs articles={articles} featured={featuredArticles} />
          </div>
          {staffPicks.length > 0 && (
            <aside aria-labelledby="picks" className={`${CARD} h-fit p-5`}>
              <h3 id="picks" className="mb-4 text-sm font-semibold">
                Staff picks
              </h3>
              <ol className="flex flex-col gap-5">
                {staffPicks.map((article) => (
                  <li key={article.id} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted">{article.author.name ?? article.author.username}</span>
                    <Link href={storyHref(article)} className="text-sm font-semibold leading-snug hover:underline line-clamp-2">
                      {article.title}
                    </Link>
                    <span className="text-xs text-muted">
                      {article.readTime} min read
                      {article.publishedAt && ` · ${shortDate(article.publishedAt)}`}
                    </span>
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </div>
      </section>

      {/* Features teaser */}
      <section aria-labelledby="features" className={SECTION}>
        <Heading eyebrow="Features" id="features" title="Everything between a draft and a devoted reader." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WRITER_FEATURES.map(({ Icon, title, body }) => (
            <div key={title} className={`${CARD} flex flex-col gap-2.5 p-5`}>
              <Icon className="text-muted" />
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm leading-6 text-muted">{body}</p>
            </div>
          ))}
        </div>
        <Link href="/features" className={`${LEARN} mt-6 inline-block`}>
          See all features →
        </Link>
      </section>

      {/* Why blog teaser */}
      <section aria-labelledby="why" className={SECTION}>
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-12">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">Why blog</p>
            <h2 id="why" className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              A post disappears in a day. A good story keeps working for years.
            </h2>
            <ul className="flex flex-col gap-2.5 text-sm">
              {REASONS.map((reason) => (
                <li key={reason} className="flex items-start gap-2.5">
                  <CheckIcon size={16} className="mt-0.5 shrink-0 text-muted" />
                  {reason}
                </li>
              ))}
            </ul>
            <Link href="/why-blog" className={`${LEARN} self-start`}>
              Why blogging still matters →
            </Link>
          </div>
          <Wall id="why-wall" variant={2} className="px-6 py-10 sm:px-10 sm:py-14">
            <blockquote className="mx-auto max-w-md rounded-2xl border border-border bg-page/95 p-6 text-lg leading-8">
              “Writing is thinking. To write well is to think clearly.”
              <footer className="mt-3 text-sm text-muted">— David McCullough</footer>
            </blockquote>
          </Wall>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 pb-24 pt-10 text-center sm:px-6 sm:pt-16">
        <h2 className="flex flex-wrap items-center justify-center gap-x-3 text-3xl font-semibold tracking-tight sm:text-5xl">
          Start writing on <Wordmark className="h-12 sm:h-16" />
        </h2>
        <p className="max-w-md text-muted">Create a free account in under a minute. No password, no card.</p>
        <Link href={writeHref} className={buttonClass("primary", "lg")}>
          {session?.user?.id ? "Write a story" : "Create your account"} <ArrowRightIcon size={16} />
        </Link>
      </section>
    </div>
  );
}
