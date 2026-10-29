import Link from "next/link";
import type { RankedArticle } from "@/lib/engagement";

const compact = new Intl.NumberFormat("en", { notation: "compact" });

function reads(count: number) {
  return `${compact.format(count)} read${count === 1 ? "" : "s"}`;
}

export default function TrendingRail({
  trending,
  today,
}: {
  trending: RankedArticle[];
  today: RankedArticle[];
}) {
  return (
    <div className="w-full max-w-[280px] space-y-6">
      <section aria-labelledby="trending-heading" className="overflow-hidden rounded-2xl border border-border bg-background">
        <h2 id="trending-heading" className="px-4 pb-2 pt-4 text-lg font-bold">
          What&apos;s trending
        </h2>
        {trending.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted">Nothing is trending yet.</p>
        ) : (
          <ol>
            {trending.map((article, index) => (
              <li key={article.id}>
                <Link href={`/${article.username}/${article.slug}`} className="block px-4 py-3 transition-colors hover:bg-surface">
                  <p className="text-xs text-muted">
                    {index + 1} · Trending{article.topic ? <> in <span className="capitalize">{article.topic}</span></> : null}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug">{article.title}</p>
                  {article.views > 0 && <p className="mt-0.5 text-xs text-muted">{reads(article.views)}</p>}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="today-heading" className="rounded-2xl border border-border p-4">
        <h2 id="today-heading" className="text-lg font-bold">
          Most viewed today
        </h2>
        {today.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No reads yet today.</p>
        ) : (
          <ol className="mt-3 space-y-4">
            {today.map((article, index) => (
              <li key={article.id} className="flex gap-3">
                <span aria-hidden className="w-8 flex-shrink-0 text-2xl font-bold leading-none text-border-strong tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Link href={`/${article.username}/${article.slug}`} className="group min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug group-hover:underline">{article.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    @{article.username} · {reads(article.views)}
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
