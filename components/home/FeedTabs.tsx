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
  author: { username: string | null; name: string | null; avatarUrl: string | null };
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
      <div className="flex gap-6 border-b border-border mb-2">
        {(["for-you", "featured"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className="pb-3 text-sm font-medium border-b-2 -mb-px transition-colors border-transparent text-muted hover:text-foreground aria-pressed:border-foreground aria-pressed:text-foreground"
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
