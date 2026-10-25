"use client";

import { useState } from "react";
import ArticleCard from "@/components/article/ArticleCard";

type Article = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverImage: string | null;
  readTime: number;
  memberOnly: boolean;
  publishedAt: Date | null;
  author: { username: string | null; name: string | null; avatarUrl: string | null; image?: string | null };
  tags: { tag: { name: string; slug: string } }[];
  _count: { claps: number; comments: number };
};

type Props = {
  articles: Article[];
  featured: Article[];
};

export default function FeedTabs({ articles, featured }: Props) {
  const [tab, setTab] = useState<"for-you" | "featured">("for-you");
  const list = tab === "for-you" ? articles : featured;

  return (
    <div>
      <div className="mb-2 inline-flex rounded-full border border-border bg-background p-1">
        {(["for-you", "featured"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className="rounded-full px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground"
          >
            {t === "for-you" ? "For you" : "Featured"}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="py-10 text-center text-muted text-sm">No articles yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {list.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
