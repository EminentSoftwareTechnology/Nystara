"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import UserMenu from "@/components/layout/UserMenu";

function PencilLogoIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="6" fill="#111827" />
      <path d="M7 9h14M7 14h10M7 19h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

type Props = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  username: string | null;
};

export default function StoryEditor({ name, email, avatarUrl, username }: Props) {
  const router = useRouter();
  const titleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ id: string; slug: string; author: { username: string } } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  async function handlePublish() {
    const title = titleRef.current?.innerText.trim() ?? "";
    const contentText = bodyRef.current?.innerText.trim() ?? "";

    if (!title) {
      setError("Title is required.");
      return;
    }

    setPublishing(true);
    setError("");

    try {
      let article = draft;
      if (!article) {
        const res = await fetch("/api/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content: { type: "doc", text: contentText }, contentText, memberOnly: false }),
        });
        if (!res.ok) {
          setError("Failed to save your story.");
          return;
        }
        article = await res.json() as { id: string; slug: string; author: { username: string } };
        setDraft(article);
      } else {
        const saved = await fetch(`/api/articles/${article.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content: { type: "doc", text: contentText }, contentText }),
        });
        if (!saved.ok) {
          setError("Failed to update your draft.");
          return;
        }
      }
      const published = await fetch(`/api/articles/${article.id}/publish`, { method: "POST" });
      if (!published.ok) {
        setError("Your draft was saved. Publication failed; please retry.");
        return;
      }
      router.push(`/${article.author.username}/${article.slug}`);
    } catch {
      setError("Unable to publish. Check your connection and retry.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-100 dark:border-gray-900">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-gray-900 dark:text-white">
            <PencilLogoIcon />
            TechScribe
          </Link>
          <span className="text-sm text-gray-400 dark:text-gray-500">Draft</span>
        </div>

        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-red-500">{error}</span>}
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="px-4 py-2 rounded-full bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
          <button
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            aria-label="More options"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
            </svg>
          </button>
          <button className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors" aria-label="Notifications">
            <BellIcon />
          </button>
          <UserMenu name={name} email={email} avatarUrl={avatarUrl} username={username} />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center py-12 px-4">
        <div className="w-full max-w-2xl">
          <div
            ref={titleRef}
            role="textbox"
            aria-label="Title"
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Title"
            className="text-4xl font-bold text-gray-900 dark:text-white outline-none mb-4 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300 dark:empty:before:text-gray-700 leading-tight"
          />
          <div className="flex items-start gap-3">
            <button
              className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:border-gray-500 dark:hover:border-gray-400 flex-shrink-0 mt-0.5 transition-colors"
              aria-label="Add content"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="7" y1="1" x2="7" y2="13" />
                <line x1="1" y1="7" x2="13" y2="7" />
              </svg>
            </button>
            <div
              ref={bodyRef}
              role="textbox"
              aria-label="Story text"
              aria-multiline="true"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Tell your story..."
              className="flex-1 text-xl text-gray-900 dark:text-white outline-none leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300 dark:empty:before:text-gray-700 min-h-96"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
