"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonClass, INPUT } from "@/components/ui";
import { libraryMutation } from "@/components/library/LibraryControls";

type List = { id: string; name: string; items: { articleId: string }[] };
export default function ArticleLibraryActions({
  articleId,
  signedIn,
}: {
  articleId: string;
  signedIn: boolean;
}) {
  const [lists, setLists] = useState<List[]>([]);
  const [bookmarked, setBookmarked] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [quote, setQuote] = useState("");
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    void fetch(`/api/me/library?articleId=${articleId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load library.");
        const data: { lists: List[]; bookmarked: boolean } =
          await response.json();
        if (active) {
          setLists(data.lists);
          setBookmarked(data.bookmarked);
          setReady(true);
        }
      })
      .catch(() => {
        if (active)
          setError("Could not load your library. Reload to try again.");
      });
    return () => {
      active = false;
    };
  }, [articleId, signedIn]);
  async function save(
    input: Record<string, unknown>,
    complete: () => void,
    message: string,
  ) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await libraryMutation(input);
      complete();
      setStatus(message);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  if (!signedIn)
    return (
      <p className="mt-4 text-sm text-muted">
        <Link href="/login" className="underline">
          Sign in
        </Link>{" "}
        to save stories, collect highlights and build your reading lists.
      </p>
    );
  return (
    <section aria-label="Save this story" className="mt-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !ready}
          aria-pressed={bookmarked}
          className={buttonClass(bookmarked ? "primary" : "secondary", "sm")}
          onClick={() =>
            void save(
              { action: "bookmark", articleId, saved: !bookmarked },
              () => setBookmarked(!bookmarked),
              bookmarked
                ? "Story removed from your reading list."
                : "Story saved to your reading list.",
            )
          }
        >
          {bookmarked ? "Saved story" : "Save story"}
        </button>
        <button
          type="button"
          className={buttonClass("secondary", "sm")}
          disabled={!ready}
          aria-expanded={listOpen}
          onClick={() => setListOpen(!listOpen)}
        >
          Add to a list
        </button>
        <button
          type="button"
          className={buttonClass("secondary", "sm")}
          disabled={!ready}
          aria-expanded={highlightOpen}
          onClick={() => {
            const selection = window.getSelection()?.toString().trim() ?? "";
            if (selection) setQuote(selection);
            setHighlightOpen(!highlightOpen);
          }}
        >
          Save highlight
        </button>
        <Link href="/me/library" className={buttonClass("ghost", "sm")}>
          Your library
        </Link>
      </div>
      {listOpen && (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Choose a collection</h2>
          {!lists.length ? (
            <p className="mt-3 text-sm text-muted">
              Create your first list in{" "}
              <Link href="/me/library" className="underline">
                your library
              </Link>
              .
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {lists.map((list) => (
                <label
                  key={list.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={list.items.length > 0}
                    disabled={busy}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      void save(
                        {
                          action: "listItem",
                          articleId,
                          listId: list.id,
                          saved: checked,
                        },
                        () =>
                          setLists((previous) =>
                            previous.map((item) =>
                              item.id === list.id
                                ? {
                                    ...item,
                                    items: checked ? [{ articleId }] : [],
                                  }
                                : item,
                            ),
                          ),
                        checked
                          ? "Added to collection."
                          : "Removed from collection.",
                      );
                    }}
                  />
                  {list.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      {highlightOpen && (
        <form
          className="mt-4 space-y-3 rounded-2xl border border-border bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            void save(
              { action: "highlight", articleId, quote, note: data.get("note") },
              () => {
                setHighlightOpen(false);
                setQuote("");
              },
              "Highlight saved to your library.",
            );
          }}
        >
          <label className="block text-sm">
            Passage from this story
            <textarea
              required
              maxLength={3000}
              value={quote}
              onChange={(event) => setQuote(event.target.value)}
              rows={3}
              placeholder="Select text before clicking Save highlight, or paste a passage here."
              className={`${INPUT} mt-2 py-3`}
            />
          </label>
          <label className="block text-sm">
            Your note <span className="text-muted">(optional)</span>
            <textarea
              name="note"
              rows={2}
              maxLength={2000}
              className={`${INPUT} mt-2 py-3`}
            />
          </label>
          <button disabled={busy} className={buttonClass("primary", "sm")}>
            {busy ? "Saving…" : "Save highlight"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="mt-3 text-sm text-muted">
          {status}
        </p>
      )}
    </section>
  );
}
