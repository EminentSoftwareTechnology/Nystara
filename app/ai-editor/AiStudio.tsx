"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { legacyDocument } from "@/lib/story-document";
import {
  localDraftKey,
  readLocalDraft,
  writeLocalDraft,
} from "@/lib/local-draft";
import type {
  AiAttachment,
  ChatConversation,
  ChatMessage,
} from "@/lib/ai-chat";
import { WandIcon } from "@/components/icons";
import { CARD, buttonClass, cx } from "@/components/ui";

const PROMPTS = [
  {
    title: "Find my next idea",
    text: "Help me brainstorm five fresh story ideas. Ask me about my interests first.",
  },
  {
    title: "Shape an outline",
    text: "Help me build an engaging story outline. Ask me about my topic and audience.",
  },
  {
    title: "Polish a draft",
    text: "I'd like you to edit a draft for clarity and flow while preserving my voice. I'll share it next.",
  },
  {
    title: "Find a better headline",
    text: "Help me create five specific, compelling headlines without clickbait. Ask me about my story.",
  },
];
const ACCEPT = ".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg";
const MIME: Record<string, AiAttachment["type"]> = {
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export default function AiStudio({
  premium,
  owner,
  conversations: initial,
}: {
  premium: boolean;
  owner: string;
  conversations: ChatConversation[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [conversations, setConversations] = useState(initial);
  const [active, setActive] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function openChat(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/ai/editor?id=${encodeURIComponent(id)}`,
      );
      const data = (await response.json()) as {
        messages?: ChatMessage[];
        error?: string;
      };
      if (!response.ok || !data.messages)
        throw new Error(data.error ?? "Could not open conversation.");
      setActive(id);
      setMessages(data.messages);
      setText("");
      setAttachments([]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not open conversation.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeChat() {
    if (!active || busy || uploading) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/ai/editor?id=${encodeURIComponent(active)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Could not delete conversation.");
      setConversations((items) => items.filter((item) => item.id !== active));
      setActive(undefined);
      setMessages([]);
      setText("");
      setAttachments([]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not delete conversation.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function attach(event: ChangeEvent<HTMLInputElement>) {
    if (busy || uploading) return;
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setError("");
    if (
      files.length + attachments.length > 3 ||
      files.reduce(
        (sum, file) => sum + file.size,
        attachments.reduce(
          (sum, file) => sum + Math.ceil((file.data.length * 3) / 4),
          0,
        ),
      ) > 500_000
    ) {
      setError("Attach up to 3 files, totalling 500 KB or less.");
      return;
    }
    setUploading(true);
    try {
      const loaded: AiAttachment[] = [];
      for (const file of files) {
        const type = MIME[file.name.split(".").pop()?.toLowerCase() ?? ""];
        if (!type) {
          setError(
            "Choose a text, Markdown, CSV, JSON, PDF, PNG or JPEG file.",
          );
          return;
        }
        try {
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = () => reject(new Error("Could not read file."));
            reader.readAsDataURL(file);
          });
          loaded.push({ name: file.name.slice(0, 120), type, data });
        } catch {
          setError("Could not read this file. Please try again.");
          return;
        }
      }
      setAttachments((existing) => [...existing, ...loaded]);
    } finally {
      setUploading(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy || uploading) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/ai/editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: active, text, attachments }),
      });
      const data = (await response.json()) as {
        conversation?: ChatConversation;
        messages?: ChatMessage[];
        error?: string;
      };
      if (!response.ok || !data.conversation || !data.messages)
        throw new Error(data.error ?? "AI request failed.");
      const chat = data.conversation;
      setActive(chat.id);
      setMessages((existing) => [...existing, ...data.messages!]);
      setConversations((items) =>
        [chat, ...items.filter((item) => item.id !== chat.id)].slice(0, 50),
      );
      setText("");
      setAttachments([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI request failed.");
    } finally {
      setBusy(false);
    }
  }

  function sendToStory(result: string) {
    const key = localDraftKey(owner, null);
    const existing = readLocalDraft(key);
    writeLocalDraft(key, {
      draft: existing?.draft ?? null,
      title: existing?.title ?? "",
      subtitle: existing?.subtitle ?? "",
      content: {
        type: "doc",
        content: [
          ...(existing?.content.content ?? []),
          ...(legacyDocument(result).content ?? []),
        ],
      },
      memberOnly: existing?.memberOnly ?? false,
      coverImage: existing?.coverImage ?? null,
      savedAt: Date.now(),
    });
    router.push("/new-story");
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied to clipboard.");
    } catch {
      setError("Could not copy. Select the response and copy it instead.");
    }
  }

  if (!premium)
    return (
      <div className={`${CARD} mt-8 p-6`}>
        <h2 className="text-xl font-semibold">
          AI editing is part of premium membership
        </h2>
        <p className="my-4 text-sm text-muted">
          The story editor keeps your writing safe while premium access is being
          prepared.
        </p>
        <Link href="/new-story" className={buttonClass()}>
          Open the story editor
        </Link>
      </div>
    );

  return (
    <div
      className={`${CARD} mt-8 overflow-hidden lg:grid lg:grid-cols-[220px_minmax(0,1fr)]`}
    >
      <aside className="border-b border-border bg-surface/50 p-4 lg:border-r lg:border-b-0">
        <button
          disabled={busy || uploading}
          className={buttonClass("secondary", "md", "w-full")}
          onClick={() => {
            setActive(undefined);
            setMessages([]);
            setText("");
            setAttachments([]);
            setError("");
            setNotice("");
          }}
        >
          + New chat
        </button>
        <h2 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Your conversations
        </h2>
        <div className="flex max-h-44 gap-2 overflow-auto lg:max-h-[600px] lg:flex-col">
          {conversations.length ? (
            conversations.map((chat) => (
              <button
                disabled={busy || uploading}
                key={chat.id}
                onClick={() => void openChat(chat.id)}
                className={cx(
                  "min-w-36 rounded-xl p-3 text-left text-sm lg:min-w-0",
                  chat.id === active
                    ? "bg-surface-2 font-medium"
                    : "hover:bg-surface-2",
                )}
              >
                <span className="line-clamp-2 break-words">{chat.title}</span>
              </button>
            ))
          ) : (
            <p className="text-xs leading-5 text-muted">
              Your chats are private and saved to your account.
            </p>
          )}
        </div>
      </aside>
      <section
        className="flex min-h-[660px] min-w-0 flex-col"
        aria-label="AI editor chat"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="flex items-center gap-2 text-sm font-medium">
            <WandIcon size={18} /> AI editor
          </span>
          {active && (
            <button
              disabled={busy || uploading}
              onClick={() => void removeChat()}
              className="text-xs text-muted underline underline-offset-4"
            >
              Delete chat
            </button>
          )}
        </div>
        <div
          className="flex-1 px-5 py-8 sm:px-8"
          aria-live="polite"
          aria-busy={busy}
        >
          {!messages.length ? (
            <div className="mx-auto max-w-xl py-4 sm:py-12">
              <span className="mb-6 inline-flex rounded-2xl bg-surface-2 p-4">
                <WandIcon size={26} />
              </span>
              <h2 className="font-display text-3xl">
                What are we writing today?
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Start with a question, an unfinished sentence, or a file. We’ll
                work through it together.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {PROMPTS.map((prompt) => (
                  <button
                    disabled={busy || uploading}
                    key={prompt.title}
                    onClick={() => setText(prompt.text)}
                    className="rounded-xl border border-border p-4 text-left text-sm transition-colors hover:bg-surface"
                  >
                    <span className="font-medium">
                      {prompt.title} <span aria-hidden>↗</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-2xl flex-col gap-7">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={cx(
                    "min-w-0",
                    message.role === "user" &&
                      "ml-6 rounded-2xl bg-surface px-5 py-4 sm:ml-12",
                  )}
                >
                  <h3 className="mb-2 text-xs font-semibold text-muted">
                    {message.role === "user" ? "You" : "AI editor"}
                  </h3>
                  <p className="whitespace-pre-wrap break-words text-sm leading-7">
                    {message.content}
                  </p>
                  {message.attachments?.map((file, index) => (
                    <span
                      key={`${file.name}-${index}`}
                      className="mt-2 mr-2 inline-block rounded-lg border border-border px-2 py-1 text-xs"
                    >
                      {file.name}
                    </span>
                  ))}
                  {message.role === "assistant" && (
                    <div className="mt-3 flex gap-4">
                      <button
                        className="text-xs text-muted underline underline-offset-4"
                        onClick={() => void copy(message.content)}
                      >
                        Copy
                      </button>
                      <button
                        className="text-xs text-muted underline underline-offset-4"
                        onClick={() => sendToStory(message.content)}
                      >
                        Add to story
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
          {busy && (
            <p
              role="status"
              className="mx-auto mt-5 max-w-2xl animate-pulse text-sm text-muted"
            >
              Working on it…
            </p>
          )}
        </div>
        <div className="px-4 pb-5 sm:px-8">
          {error && (
            <p role="alert" className="mb-3 text-sm text-danger">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mb-3 text-sm text-muted">
              {notice}
            </p>
          )}
          <form
            onSubmit={send}
            className="mx-auto max-w-2xl rounded-2xl border border-border-strong bg-page p-3 shadow-sm"
          >
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <span
                    key={`${file.name}-${index}`}
                    className="flex max-w-full items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs"
                  >
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      disabled={busy || uploading}
                      onClick={() =>
                        setAttachments((files) =>
                          files.filter((_, i) => i !== index),
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <textarea
              aria-label="Message AI editor"
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={busy || uploading}
              maxLength={12000}
              rows={3}
              placeholder="Message your AI editor…"
              className="max-h-72 min-h-24 w-full resize-y bg-transparent px-1 text-sm leading-6 outline-none"
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                multiple
                onChange={(event) => void attach(event)}
                disabled={busy || uploading}
                className="hidden"
              />
              <button
                disabled={busy || uploading}
                type="button"
                onClick={() => fileInput.current?.click()}
                className={buttonClass("ghost", "sm")}
              >
                + Attach files
              </button>
              <button
                disabled={busy || uploading || !text.trim()}
                type="submit"
                className={buttonClass("primary", "sm")}
              >
                {uploading ? "Reading files…" : busy ? "Thinking…" : "Send ↑"}
              </button>
            </div>
          </form>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[11px] leading-5 text-muted">
            Text, PDF and images · Up to 3 files, 500 KB total · Messages and
            files are sent to OpenAI. Review suggestions before publishing.
          </p>
        </div>
      </section>
    </div>
  );
}
