"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AI_ACTIONS } from "@/lib/ai-editor";
import { legacyDocument } from "@/lib/story-document";
import { localDraftKey, readLocalDraft, writeLocalDraft } from "@/lib/local-draft";
import { LockIcon, WandIcon } from "@/components/icons";
import { CARD, buttonClass, cx } from "@/components/ui";

type Action = keyof typeof AI_ACTIONS;

const LABELS: Record<Action, { title: string; hint: string }> = {
  polish: { title: "Polish", hint: "Grammar, clarity and flow" },
  shorten: { title: "Shorten", hint: "Same points, fewer words" },
  expand: { title: "Expand", hint: "Explain it more fully" },
  outline: { title: "Outline", hint: "Structure for a story" },
  titles: { title: "Titles", hint: "Five title ideas" },
  feedback: { title: "Feedback", hint: "An editor’s notes" },
};

const MAX = 12000;

export default function AiStudio({ premium, owner }: { premium: boolean; owner: string }) {
  const router = useRouter();
  const storageKey = `nystara:ai:${owner}`;
  const [text, setText] = useState("");
  const [action, setAction] = useState<Action>("polish");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore this browser's last passage
      if (saved) setText(saved);
    } catch {
      // Storage blocked: start empty.
    }
  }, [storageKey]);

  function update(value: string) {
    setText(value);
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // Storage blocked: the passage just isn't remembered.
    }
  }

  async function generate() {
    setBusy(true);
    setError("");
    setNotice("");
    setResult("");
    try {
      const response = await fetch("/api/ai/editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text }),
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !data.text) throw new Error(data.error ?? "AI request failed.");
      setResult(data.text);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI request failed.");
    } finally {
      setBusy(false);
    }
  }

  /** Appends the suggestion to the in-progress story behind /new-story, creating it if there isn't one. */
  function sendToStory() {
    const key = localDraftKey(owner, null);
    const existing = readLocalDraft(key);
    const added = legacyDocument(result).content ?? [];
    writeLocalDraft(key, {
      draft: existing?.draft ?? null,
      title: existing?.title ?? "",
      subtitle: existing?.subtitle ?? "",
      content: { type: "doc", content: [...(existing?.content.content ?? []), ...added] },
      memberOnly: existing?.memberOnly ?? false,
      coverImage: existing?.coverImage ?? null,
      savedAt: Date.now(),
    });
    router.push("/new-story");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result);
      setNotice("Copied.");
    } catch {
      setError("Couldn’t copy. Select the text and copy it instead.");
    }
  }

  if (!premium) {
    return (
      <div className={`${CARD} mt-8 flex flex-col items-start gap-4 p-6 sm:p-8`}>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface">
          <LockIcon size={20} />
        </span>
        <h2 className="text-xl font-semibold tracking-tight">AI editing is part of premium membership</h2>
        <p className="max-w-xl text-sm leading-6 text-muted">
          Premium billing isn’t available yet. Until then, the story editor is free to use and keeps your writing safe
          while you work.
        </p>
        <Link href="/new-story" className={buttonClass("primary", "md")}>
          Open the story editor
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-2">
      <section className={`${CARD} flex flex-col gap-4 p-5 sm:p-6`} aria-labelledby="ai-input">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="ai-input" className="font-semibold">
            Your text
          </h2>
          <span className={cx("text-xs", text.length > MAX ? "text-danger" : "text-muted")}>
            {text.length.toLocaleString()} / {MAX.toLocaleString()}
          </span>
        </div>
        <textarea
          aria-label="Text for the AI editor"
          value={text}
          onChange={(e) => update(e.target.value)}
          rows={14}
          placeholder="Paste a passage, a rough draft or an idea…"
          className="min-h-72 w-full resize-y rounded-xl border border-border bg-page p-4 font-display text-lg leading-8 outline-none focus:border-border-strong"
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">What should it do?</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(LABELS) as Action[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={action === key}
                onClick={() => setAction(key)}
                className="flex flex-col items-start gap-0.5 rounded-xl border border-border px-3 py-2.5 text-left transition-colors hover:bg-surface aria-pressed:border-foreground aria-pressed:bg-surface"
              >
                <span className="text-sm font-medium">{LABELS[key].title}</span>
                <span className="text-xs text-muted">{LABELS[key].hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <p className="text-xs leading-5 text-muted">
          Generate sends this text to OpenAI. Up to 12,000 characters and 30 requests a day.
        </p>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy || !text.trim() || text.length > MAX}
          className={buttonClass("primary", "md")}
        >
          <WandIcon size={16} />
          {busy ? "Thinking…" : `${LABELS[action].title} it`}
        </button>
      </section>

      <section className={`${CARD} flex flex-col gap-4 p-5 sm:p-6`} aria-labelledby="ai-output" aria-busy={busy}>
        <h2 id="ai-output" className="font-semibold">
          Suggestion
        </h2>
        {error && (
          <p role="alert" className="rounded-xl border border-danger px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        {result ? (
          <>
            <textarea
              aria-label="AI suggestion"
              value={result}
              onChange={(e) => setResult(e.target.value)}
              rows={14}
              className="min-h-72 w-full resize-y rounded-xl border border-border bg-page p-4 font-display text-lg leading-8 outline-none focus:border-border-strong"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={sendToStory} className={buttonClass("primary", "sm")}>
                Add to my new story
              </button>
              <button type="button" onClick={() => update(result)} className={buttonClass("secondary", "sm")}>
                Use as my text
              </button>
              <button type="button" onClick={() => void copy()} className={buttonClass("secondary", "sm")}>
                Copy
              </button>
              <button type="button" onClick={() => setResult("")} className={buttonClass("ghost", "sm")}>
                Discard
              </button>
            </div>
            {notice && (
              <p role="status" className="text-sm text-muted">
                {notice}
              </p>
            )}
          </>
        ) : (
          <div className="flex min-h-72 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            <WandIcon size={24} />
            {busy ? "Working on it…" : "Choose an action and generate. The suggestion appears here for you to review."}
          </div>
        )}
      </section>
    </div>
  );
}
