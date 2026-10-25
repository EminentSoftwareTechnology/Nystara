import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/request";
import { publishDueStories } from "@/lib/story-status";
import AppShell from "@/components/layout/AppShell";
import ArticleCard from "@/components/article/ArticleCard";
import TopicButton from "@/components/social/TopicButton";
import { buttonClass } from "@/components/ui";

export default async function TopicPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const page = parsePage((await searchParams).page);
  const [topic, session] = await Promise.all([
    prisma.tag.findUnique({ where: { slug }, select: { id: true, name: true } }),
    auth(),
  ]);
  if (!topic) notFound();
  await publishDueStories();
  const [articles, follow] = await Promise.all([
    prisma.article.findMany({
      where: { published: true, unlisted: false, tags: { some: { tagId: topic.id } } },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 20, take: 21,
      select: { id: true, slug: true, title: true, subtitle: true, coverImage: true,
        readTime: true, memberOnly: true, publishedAt: true,
        author: { select: { username: true, name: true, avatarUrl: true, image: true } },
        tags: { select: { tag: { select: { name: true, slug: true } } } },
        _count: { select: { claps: true, comments: true } },
      },
    }),
    session?.user?.id ? prisma.topicFollow.findUnique({ where: { userId_tagId: { userId: session.user.id, tagId: topic.id } } }) : null,
  ]);
  return <AppShell requireAuth={false}><div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-7">
      <div><p className="text-xs uppercase tracking-widest text-muted">Explore a topic</p><h1 className="mt-3 font-display text-4xl capitalize">{topic.name}</h1><p className="mt-3 text-sm text-muted">Ideas and perspectives from the Nystara community.</p></div>
      {session?.user?.id ? <TopicButton topicId={topic.id} initialFollowing={!!follow} /> : <Link href="/login" className={buttonClass("secondary", "sm")}>Sign in to follow</Link>}
    </header>
    <div className="divide-y divide-border">{articles.slice(0,20).map(article => <ArticleCard key={article.id} article={article} />)}</div>
    {!articles.length && <p className="py-16 text-center text-muted">No published stories on this topic yet.</p>}
    <nav aria-label="Topic pages" className="mt-6 flex justify-between"><div>{page > 1 && <Link href={`/tag/${slug}?page=${page-1}`} className={buttonClass("secondary", "sm")}>Previous</Link>}</div>{articles.length > 20 && <Link href={`/tag/${slug}?page=${page+1}`} className={buttonClass("secondary", "sm")}>Next</Link>}</nav>
  </div></AppShell>;
}
