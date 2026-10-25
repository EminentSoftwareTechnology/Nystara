"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { documentText } from "@/lib/story-document";
import { markdownDocument } from "@/lib/markdown-import";
import { buttonClass, INPUT, CARD } from "@/components/ui";
import { MAX_CONTENT_CHARS } from "@/lib/request";

export default function ImportStory() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function importFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!/\.(txt|md|markdown)$/i.test(file.name) || file.size > 400_000) {
      setError("Choose a .txt or .md file under 400 KB.");
      return;
    }
    setReading(true);
    try {
      const contents = await file.text();
      if (contents.length > MAX_CONTENT_CHARS) {
        setError("Stories can contain up to 100,000 characters.");
        return;
      }
      setText(contents);
      if (!title)
        setTitle(
          file.name
            .replace(/\.(txt|md|markdown)$/i, "")
            .replace(/[-_]/g, " ")
            .slice(0, 250),
        );
    } catch {
      setError(
        "Could not read that file. Try another file or paste your writing below.",
      );
    } finally {
      setReading(false);
    }
  }
  async function createDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const content = markdownDocument(text);
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          contentText: documentText(content),
        }),
      });
      if (!response.ok)
        throw new Error(
          "Could not import your story. Check its length and try again.",
        );
      const article = (await response.json()) as { id: string };
      router.push(`/editor/${article.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not import this story.",
      );
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={createDraft}
      className={`${CARD} mt-7 space-y-5 p-5 sm:p-7`}
    >
      <label className="block text-sm font-medium">
        Upload text or Markdown
        <input
          type="file"
          disabled={busy || reading}
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          className="mt-2 block w-full rounded-xl border border-dashed border-border-strong bg-page p-5 text-sm"
          onChange={(event) => void importFile(event.target.files?.[0])}
        />
      </label>
      <p className="text-xs text-muted">
        Markdown headings, lists, quotes, code, bold, italic and links become
        editor formatting. Plain text keeps its paragraphs.
      </p>
      <label className="block text-sm font-medium">
        Story title
        <input
          required
          disabled={busy || reading}
          maxLength={250}
          className={`${INPUT} mt-2`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="A title worth opening"
        />
      </label>
      <label className="block text-sm font-medium">
        Your story
        <textarea
          required
          disabled={busy || reading}
          maxLength={MAX_CONTENT_CHARS}
          className={`${INPUT} mt-2 min-h-72 py-3 leading-7`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste your story here…"
        />
      </label>
      <p className="text-xs text-muted">
        {text.length.toLocaleString()} / 100,000 characters
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          className={buttonClass()}
          disabled={busy || reading || !title.trim() || !text.trim()}
        >
          {reading
            ? "Reading file…"
            : busy
              ? "Creating draft…"
              : "Import into editor"}
        </button>
        <Link href="/me/stories" className={buttonClass("secondary")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
