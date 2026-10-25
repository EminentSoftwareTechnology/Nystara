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
      <div className="flex gap-6 border-b border-gray-200 dark:border-gray-800 mb-2">
        {(["for-you", "featured"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t === "for-you" ? "For you" : "Featured"}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="py-10 text-center text-gray-500 dark:text-gray-400 text-sm">No articles yet.</p>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {list.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
