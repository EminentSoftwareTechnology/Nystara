"use client";

import { useState } from "react";
import type { FeedbackSummary } from "@/lib/engagement";

type Props = { articleId: string; initial: FeedbackSummary };
type Change = { reaction?: "LIKE" | "DISLIKE" | null; rating?: number | null };

function Thumb({ down = false }: { down?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={down ? "rotate-180" : undefined}>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d="m12 2.5 2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5Z" />
    </svg>
  );
}

function optimistic(summary: FeedbackSummary, change: Change): FeedbackSummary {
  const next = { ...summary, mine: { ...summary.mine } };
  if (change.reaction !== undefined) {
    if (summary.mine.reaction === "LIKE") next.likes--;
    if (summary.mine.reaction === "DISLIKE") next.dislikes--;
    if (change.reaction === "LIKE") next.likes++;
    if (change.reaction === "DISLIKE") next.dislikes++;
    next.mine.reaction = change.reaction;
  }
  if (change.rating !== undefined) next.mine.rating = change.rating;
  return next;
}

export default function ArticleFeedback({ articleId, initial }: Props) {
  const [summary, setSummary] = useState(initial);
  const [hover, setHover] = useState(0);
  const [error, setError] = useState("");

  async function send(change: Change) {
    // Like and rating requests can overlap; each response is the full server state, so the latest one wins.
    const previous = summary;
    setSummary((current) => optimistic(current, change));
    setError("");
    try {
      const response = await fetch(`/api/articles/${articleId}/feedback`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      const result = (await response.json()) as FeedbackSummary & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Couldn't save your vote.");
      setSummary(result);
    } catch (cause) {
      setSummary(previous);
      setError(cause instanceof Error ? cause.message : "Couldn't save your vote.");
    }
  }

  const reactionButton = (type: "LIKE" | "DISLIKE") => {
    const active = summary.mine.reaction === type;
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={type === "LIKE" ? "Like" : "Dislike"}
        onClick={() => void send({ reaction: active ? null : type })}
        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${active ? "border-foreground bg-foreground text-page" : "border-border bg-page hover:bg-surface"}`}
      >
        <Thumb down={type === "DISLIKE"} />
        <span>{type === "LIKE" ? summary.likes : summary.dislikes}</span>
      </button>
    );
  };

  const shown = hover || summary.mine.rating || 0;

  return (
    <section aria-label="Your feedback" className="rounded-2xl border border-border bg-background p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <h2 className="text-sm font-semibold">Did you enjoy this story?</h2>
          <div className="mt-3 flex gap-2">
            {reactionButton("LIKE")}
            {reactionButton("DISLIKE")}
          </div>
        </div>
        <div>
          <h2 id="rating-label" className="text-sm font-semibold">
            Rate this story
          </h2>
          <div className="mt-2 flex items-center gap-3">
            <div role="radiogroup" aria-labelledby="rating-label" className="flex text-amber-500" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={summary.mine.rating === value}
                  aria-label={`${value} star${value > 1 ? "s" : ""}`}
                  onMouseEnter={() => setHover(value)}
                  onFocus={() => setHover(value)}
                  onBlur={() => setHover(0)}
                  onClick={() => void send({ rating: summary.mine.rating === value ? null : value })}
                  className="p-0.5"
                >
                  <Star filled={value <= shown} />
                </button>
              ))}
            </div>
            <p className="text-sm text-muted">
              {summary.ratingAverage !== null ? (
                <>
                  <span className="font-semibold text-foreground">{summary.ratingAverage.toFixed(1)}</span>
                  {" · "}
                  {summary.ratingCount} rating{summary.ratingCount === 1 ? "" : "s"}
                </>
              ) : (
                "No ratings yet"
              )}
            </p>
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
