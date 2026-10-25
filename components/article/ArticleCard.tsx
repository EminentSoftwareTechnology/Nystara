import Link from "next/link";
import Image from "next/image";

type ArticleCardProps = {
  article: {
    id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    coverImage: string | null;
    readTime: number;
    memberOnly: boolean;
    publishedAt: Date | null;
    author: { username: string | null; name: string | null; avatarUrl: string | null };
    tags: { tag: { name: string; slug: string } }[];
    _count: { claps: number; comments: number };
  };
};

export default function ArticleCard({ article }: ArticleCardProps) {
  const authorHandle = article.author.username ?? "";
  const href = authorHandle ? `/${authorHandle}/${article.slug}` : "#";

  return (
    <article className="py-6 flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          {article.author.avatarUrl ? (
            <Image
              src={article.author.avatarUrl}
              alt={article.author.name ?? article.author.username ?? "Author"}
              width={24}
              height={24}
              className="rounded-full"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-surface-2 flex-shrink-0" />
          )}
          <Link
            href={authorHandle ? `/${authorHandle}` : "#"}
            className="text-sm font-medium hover:underline"
          >
            {article.author.name ?? article.author.username}
          </Link>
          {article.publishedAt && (
            <span className="text-sm text-muted">
              ·{" "}
              {new Date(article.publishedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>

        <Link href={href} className="group">
          <h2 className="text-xl font-semibold tracking-tight leading-snug group-hover:underline line-clamp-2">
            {article.title}
          </h2>
          {article.subtitle && (
            <p className="mt-1 text-muted line-clamp-2 text-sm leading-6">
              {article.subtitle}
            </p>
          )}
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>{article.readTime} min read</span>
          {article.memberOnly && (
            <span className="inline-flex items-center rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-foreground">
              Member
            </span>
          )}
          {article.tags.slice(0, 3).map(({ tag }) => (
            <Link
              key={tag.slug}
              href={`/tag/${tag.slug}`}
              className="hover:underline"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      </div>

      {article.coverImage && (
        <Link href={href} className="flex-shrink-0">
          <Image
            src={article.coverImage}
            alt={article.title}
            width={112}
            height={112}
            className="object-cover rounded-xl border border-border w-28 h-28"
          />
        </Link>
      )}
    </article>
  );
}
