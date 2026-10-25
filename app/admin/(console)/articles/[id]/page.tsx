import { getVerifiedAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DeleteArticleButton from "./DeleteArticleButton";

type Props = { params: Promise<{ id: string }> };

export default async function AdminArticleViewPage({ params }: Props) {
  if (!(await getVerifiedAdminSession())) redirect("/admin/login");
  const { id } = await params;

  const article = await prisma.article.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      subtitle: true,
      contentText: true,
      readTime: true,
      published: true,
      memberOnly: true,
      publishedAt: true,
      createdAt: true,
      author: { select: { id: true, username: true, name: true } },
      tags: { select: { tag: { select: { slug: true, name: true } } } },
      _count: { select: { claps: true, comments: true, views: true } },
    },
  });

  if (!article) notFound();

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <Link href="/admin/articles" className="text-sm text-muted hover:text-foreground">
          ← Articles
        </Link>
        <div className="flex gap-3">
          <Link
            href={`/admin/articles/${article.id}/edit`}
            className="px-4 py-2 rounded-lg border border-border-strong text-sm font-medium hover:bg-surface"
          >
            Edit
          </Link>
          <DeleteArticleButton id={article.id} />
        </div>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          article.published
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
            : "bg-surface text-muted"
        }`}>
          {article.published ? "Live" : "Draft"}
        </span>
        {article.memberOnly && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium">
            Members only
          </span>
        )}
      </div>

      <h1 className="text-3xl font-bold text-foreground mb-2">{article.title}</h1>
      {article.subtitle && (
        <p className="text-lg text-muted mb-4">{article.subtitle}</p>
      )}

      <div className="flex items-center gap-4 text-sm text-muted mb-4">
        <span>By {article.author.name ?? article.author.username}</span>
        <span>{article.readTime} min read</span>
        <span>{new Date(article.createdAt).toLocaleDateString()}</span>
      </div>

      <div className="flex gap-4 text-sm text-muted mb-6">
        <span>{article._count.claps} claps</span>
        <span>{article._count.comments} comments</span>
        <span>{article._count.views} views</span>
      </div>

      {article.tags.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-6">
          {article.tags.map(({ tag }) => (
            <span key={tag.slug} className="text-xs px-2.5 py-1 rounded-full bg-surface text-muted">
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="bg-background rounded-2xl border border-border p-6">
        <p className="whitespace-pre-wrap leading-relaxed text-foreground text-sm">
          {article.contentText}
        </p>
      </div>
    </div>
  );
}
