import Link from "next/link";

type Props = {
  title: string;
  subtitle: string | null;
  coverImage: string | null;
  readTime: number;
  publishedAt: Date | null;
  memberOnly: boolean;
  author: { username: string | null; name: string | null; avatarUrl: string | null; image?: string | null };
  tags: { name: string; slug: string }[];
};

export default function ArticleHero({
  title,
  subtitle,
  coverImage,
  readTime,
  publishedAt,
  memberOnly,
  author,
  tags,
}: Props) {
  const authorName = author.name ?? author.username ?? "Author";
  const onImage = Boolean(coverImage);
  const muted = onImage ? "text-white/80" : "text-muted";

  return (
    <header
      className={`relative isolate overflow-hidden ${onImage ? "min-h-[440px] text-white sm:min-h-[520px]" : "border-b border-border bg-surface"}`}
    >
      {coverImage && (
        <>
          {/* Cover images are checked against allowed hosts when saved. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImage}
            alt=""
            referrerPolicy="no-referrer"
            fetchPriority="high"
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
        </>
      )}
      <div
        className={`mx-auto flex max-w-6xl flex-col justify-end px-4 sm:px-6 ${onImage ? "min-h-[440px] pb-10 pt-24 sm:min-h-[520px] sm:pb-14" : "py-14 sm:py-20"}`}
      >
        <div className="max-w-3xl">
          {(tags.length > 0 || memberOnly) && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {memberOnly && (
                <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-semibold text-black">
                  Member story
                </span>
              )}
              {tags.slice(0, 3).map((tag) => (
                <Link
                  key={tag.slug}
                  href={`/tag/${tag.slug}`}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${onImage ? "bg-white/15 backdrop-blur hover:bg-white/25" : "border border-border bg-page hover:bg-surface-2"}`}
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          )}
          <h1 className="story-display text-4xl leading-[1.1] wrap-anywhere sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          {subtitle && (
            <p className={`mt-4 max-w-2xl text-lg leading-relaxed sm:text-xl ${muted}`}>
              {subtitle}
            </p>
          )}
          <div className="mt-8 flex items-center gap-3 text-sm">
            {(author.avatarUrl ?? author.image) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={author.avatarUrl ?? author.image ?? ""}
                alt=""
                referrerPolicy="no-referrer"
                className="h-11 w-11 rounded-full object-cover ring-2 ring-white/40"
              />
            ) : (
              <span
                aria-hidden
                className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-semibold ${onImage ? "bg-white/20" : "bg-surface-2"}`}
              >
                {authorName[0]?.toUpperCase()}
              </span>
            )}
            <div>
              {author.username ? (
                <Link href={`/${author.username}`} className="font-semibold hover:underline">
                  {authorName}
                </Link>
              ) : (
                <span className="font-semibold">{authorName}</span>
              )}
              <p className={muted}>
                {readTime} min read
                {publishedAt && (
                  <>
                    {" · "}
                    <time dateTime={publishedAt.toISOString()}>
                      {publishedAt.toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </time>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
