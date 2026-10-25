import { publishDueStories } from "@/lib/story-status";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import FeedTabs from "@/components/home/FeedTabs";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { Eyebrow, Heading } from "@/components/marketing/Heading";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
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
  author: { select: { username: true, name: true, avatarUrl: true, image: true } },
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
  await publishDueStories();
  const [session, articles, featuredArticles, tags] = await Promise.all([
    auth(),
    prisma.article.findMany({
      where: { published: true, unlisted: false },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: articleSelect,
    }),
    prisma.article.findMany({
      where: { published: true, unlisted: false },
      orderBy: { claps: { _count: "desc" } },
      take: 20,
      select: articleSelect,
    }),
    prisma.tag.findMany({
      take: 10,
      select: { name: true, slug: true },
    }),
  ]);

  const [spotlight, ...staffPicks] = featuredArticles.slice(0, 4);
  const signedIn = Boolean(session?.user?.id);
  const writeHref = signedIn ? "/new-story" : "/signup";

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-10 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        <div className="flex flex-col gap-6">
          <Eyebrow>A home for long-form writing</Eyebrow>
          <h1 className="font-display text-5xl font-medium leading-[1.02] tracking-tight text-balance sm:text-7xl">
            Writing that <em className="italic">lasts</em>.
          </h1>
          <p className="max-w-lg text-lg leading-8 text-muted">
            Read deep dives from people who build things, then publish your own and grow an audience that comes back.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="#latest" className={buttonClass("primary", "lg")}>
              Start reading <ArrowRightIcon size={16} />
            </Link>
            <Link href={writeHref} className={buttonClass("secondary", "lg")}>
              Start writing
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {["Free to join", "5 member stories free every 30 days", "No password to remember"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <CheckIcon size={15} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <Wall id="hero-wall" variant={0} className="flex min-h-[22rem] items-end p-5 sm:min-h-[26rem] sm:p-8">
          {spotlight ? (
            <Link
              href={storyHref(spotlight)}
              className="group w-full rounded-2xl border border-border bg-page/90 p-6 backdrop-blur transition-transform hover:-translate-y-0.5"
            >
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Most appreciated</span>
              <p className="mt-3 font-display text-2xl font-medium leading-snug tracking-tight group-hover:underline sm:text-3xl">
                {spotlight.title}
              </p>
              {spotlight.subtitle && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{spotlight.subtitle}</p>}
              <p className="mt-4 text-xs text-muted">
                {spotlight.author.name ?? spotlight.author.username} · {spotlight.readTime} min read
              </p>
            </Link>
          ) : (
            <blockquote className="w-full rounded-2xl border border-border bg-page/90 p-6 backdrop-blur">
              <p className="font-display text-2xl leading-snug">“Writing is thinking. To write well is to think clearly.”</p>
              <footer className="mt-3 text-sm text-muted">David McCullough</footer>
            </blockquote>
          )}
        </Wall>
      </section>

      {/* Topics */}
      {tags.length > 0 && (
        <section aria-labelledby="topics" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <h2 id="topics" className="mb-4 text-sm text-muted">
            Explore what people are writing about
          </h2>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
            {tags.map((tag) => (
              <li key={tag.slug} className="shrink-0 rounded-full border border-border bg-background px-4 py-2 text-sm">
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
            <aside aria-labelledby="picks" className={`${CARD} h-fit p-6 lg:sticky lg:top-24`}>
              <h3 id="picks" className="mb-5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                Staff picks
              </h3>
              <ol className="flex flex-col gap-5">
                {staffPicks.map((article, i) => (
                  <li key={article.id} className="flex gap-4">
                    <span className="font-display text-2xl leading-none text-muted">{String(i + 1).padStart(2, "0")}</span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-xs font-medium text-muted">{article.author.name ?? article.author.username}</span>
                      <Link href={storyHref(article)} className="line-clamp-2 text-sm font-semibold leading-snug hover:underline">
                        {article.title}
                      </Link>
                      <span className="text-xs text-muted">
                        {article.readTime} min read
                        {article.publishedAt && ` · ${shortDate(article.publishedAt)}`}
                      </span>
                    </div>
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
        <FeatureGrid features={WRITER_FEATURES} />
        <Link href="/features" className={`${LEARN} mt-8 inline-block`}>
          See all features →
        </Link>
      </section>

      {/* Why blog teaser */}
      <section aria-labelledby="why" className={SECTION}>
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
          <div className="flex flex-col gap-5">
            <Eyebrow>Why blog</Eyebrow>
            <h2 id="why" className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              Social posts are forgotten by tomorrow. A good story is still being read years later.
            </h2>
            <ul className="flex flex-col gap-3 text-[15px]">
              {REASONS.map((reason) => (
                <li key={reason} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2">
                    <CheckIcon size={13} />
                  </span>
                  {reason}
                </li>
              ))}
            </ul>
            <Link href="/why-blog" className={`${LEARN} self-start`}>
              Why blogging still matters →
            </Link>
          </div>
          <Wall id="why-wall" variant={2} className="px-6 py-12 sm:px-10 sm:py-16">
            <blockquote className="mx-auto max-w-md rounded-2xl border border-border bg-page/90 p-7 backdrop-blur">
              <p className="font-display text-2xl leading-snug">“Writing is thinking. To write well is to think clearly.”</p>
              <footer className="mt-3 text-sm text-muted">David McCullough</footer>
            </blockquote>
          </Wall>
        </div>
      </section>

      {signedIn && (
        <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 pb-20 pt-6 text-center sm:px-6">
          <h2 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">What will you write next?</h2>
          <Link href="/new-story" className={buttonClass("primary", "lg")}>
            Write a story <ArrowRightIcon size={16} />
          </Link>
        </section>
      )}
    </div>
  );
}
