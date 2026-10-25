"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, INPUT } from "@/components/ui";
import type { StoryTab } from "@/lib/story-status";

export default function StoryActions({
  id,
  tab,
}: {
  id: string;
  tab: StoryTab;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function change(action: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/articles/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "schedule"
            ? { scheduledAt: new Date(date).toISOString() }
            : {}),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "Could not update this story.");
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update this story.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3">
      <button
        className="text-sm text-muted underline underline-offset-4"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Manage story
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-border bg-background p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {tab !== "published" && (
              <button
                disabled={busy}
                className={buttonClass("primary", "sm")}
                onClick={() => change("publish")}
              >
                Publish now
              </button>
            )}
            {tab !== "unlisted" && (
              <button
                disabled={busy}
                className={buttonClass("secondary", "sm")}
                onClick={() => change("unlist")}
              >
                Publish unlisted
              </button>
            )}
            {tab !== "drafts" && (
              <button
                disabled={busy}
                className={buttonClass("secondary", "sm")}
                onClick={() => change("draft")}
              >
                Return to draft
              </button>
            )}
            {tab === "drafts" && (
              <button
                disabled={busy}
                className={buttonClass("secondary", "sm")}
                onClick={() => change("submit")}
              >
                Submit for review
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted">
              Schedule publication (your local time)
              <input
                className={`${INPUT} mt-1`}
                type="datetime-local"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <button
              className={buttonClass("secondary", "sm")}
              disabled={busy || !date}
              onClick={() => change("schedule")}
            >
              Schedule
            </button>
          </div>
          <p className="text-xs text-muted">
            Unlisted stories are accessible by link and hidden from discovery.
            Submissions stay private until published.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
