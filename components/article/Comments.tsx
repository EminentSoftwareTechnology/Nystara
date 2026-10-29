"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar as ProfileAvatar } from "@/components/layout/Avatar";
import type { CommentView } from "@/lib/comments";

type Props = {
  articleId: string;
  initial: CommentView[];
  viewer: { name: string | null; avatarUrl?: string | null } | null;
};

const field =
  "w-full rounded-xl border border-border bg-page px-3.5 py-2.5 text-sm outline-none focus:border-foreground";

function relativeTime(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of units)
    if (seconds >= size) return format.format(-Math.floor(seconds / size), unit);
  return "just now";
}

function CommentForm({
  articleId,
  parentId,
  viewer,
  onPosted,
  onCancel,
}: {
  articleId: string;
  parentId?: string;
  viewer: Props["viewer"];
  onPosted: (comment: CommentView) => void;
  onCancel?: () => void;
}) {
  const pathname = usePathname();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/articles/${articleId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          parentId,
        }),
      });
      const result = (await response.json()) as CommentView & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Couldn't post your comment.");
      setBody("");
      onPosted(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't post your comment.");
    } finally {
      setBusy(false);
    }
  }

  if (!viewer) return <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="text-sm underline">Sign in to comment or review</Link>;

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-muted">
        <ProfileAvatar src={viewer.avatarUrl ?? null} name={viewer.name ?? "Reader"} size={28} />
        Commenting as <span className="font-medium text-foreground">{viewer.name ?? "you"}</span>
      </p>
      <label className="block text-sm">
        <span className="sr-only">{parentId ? "Your reply" : "Your comment"}</span>
        <textarea
          required
          maxLength={2000}
          rows={parentId ? 3 : 4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className={`${field} resize-y`}
          placeholder={parentId ? "Write a reply…" : "What are your thoughts?"}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm hover:bg-surface">
            Cancel
          </button>
        )}
        <button
          disabled={busy || !body.trim()}
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {busy ? "Posting…" : parentId ? "Reply" : "Post comment"}
        </button>
      </div>
    </form>
  );
}

function Avatar({ comment }: { comment: CommentView }) {
  return comment.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={comment.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
  ) : (
    <span aria-hidden className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold">
      {comment.name[0]?.toUpperCase()}
    </span>
  );
}

export default function Comments({ articleId, initial, viewer }: Props) {
  const [comments, setComments] = useState(initial);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const topLevel = comments.filter((comment) => !comment.parentId);
  const replies = (id: string) => comments.filter((comment) => comment.parentId === id).reverse();

  async function remove(id: string) {
    setError("");
    const response = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Couldn't delete that comment.");
      return;
    }
    setComments((current) => current.filter((comment) => comment.id !== id && comment.parentId !== id));
  }

  function renderComment(comment: CommentView, isReply = false) {
    return (
      <div className="flex gap-3">
        <Avatar comment={comment} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            {comment.username ? (
              <Link href={`/${comment.username}`} className="font-semibold hover:underline">
                {comment.name}
              </Link>
            ) : (
              <span className="font-semibold">{comment.name}</span>
            )}
            {comment.guest && (
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">Guest</span>
            )}
            <time dateTime={comment.createdAt} className="text-muted" suppressHydrationWarning>
              {relativeTime(comment.createdAt)}
            </time>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed wrap-anywhere">{comment.body}</p>
          <div className="mt-1.5 flex gap-4 text-xs text-muted">
            {!isReply && (
              <button type="button" className="hover:text-foreground" onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}>
                Reply
              </button>
            )}
            {comment.canDelete && (
              <button type="button" className="hover:text-danger" onClick={() => void remove(comment.id)}>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="comments-heading" className="space-y-6">
      <h2 id="comments-heading" className="text-xl font-semibold">
        Comments <span className="text-muted">({comments.length})</span>
      </h2>
      <div className="rounded-2xl border border-border p-4 sm:p-5">
        <CommentForm
          articleId={articleId}
          viewer={viewer}
          onPosted={(comment) => setComments((current) => [comment, ...current])}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {topLevel.length === 0 ? (
        <p className="text-sm text-muted">No comments yet. Start the conversation.</p>
      ) : (
        <ul className="divide-y divide-border">
          {topLevel.map((comment) => (
            <li key={comment.id} className="py-5">
              {renderComment(comment)}
              {(replies(comment.id).length > 0 || replyTo === comment.id) && (
                <ul className="ml-12 mt-4 space-y-4 border-l border-border pl-4">
                  {replies(comment.id).map((reply) => (
                    <li key={reply.id}>{renderComment(reply, true)}</li>
                  ))}
                  {replyTo === comment.id && (
                    <li>
                      <CommentForm
                        articleId={articleId}
                        parentId={comment.id}
                        viewer={viewer}
                        onPosted={(reply) => {
                          setComments((current) => [reply, ...current]);
                          setReplyTo(null);
                        }}
                        onCancel={() => setReplyTo(null)}
                      />
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
