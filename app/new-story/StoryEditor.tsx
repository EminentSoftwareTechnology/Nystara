"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import UserMenu from "@/components/layout/UserMenu";
import { Logo } from "@/components/brand/Logo";
import { VideoNode } from "@/components/editor/video-extension";
import Ribbon from "@/components/editor/Ribbon";
import { prepareImage } from "@/components/editor/prepare-image";
import { safeLink } from "@/lib/story-document";
import type { StoryTheme } from "@/lib/story-theme";
import {
  type LocalDraft,
  clearLocalDraft,
  localDraftKey,
  readLocalDraft,
  writeLocalDraft,
} from "@/lib/local-draft";

type Draft = { id: string; slug: string; author: { username: string | null } };
export type InitialStory = Draft & {
  title: string;
  subtitle: string | null;
  content: JSONContent;
  memberOnly: boolean;
  coverImage: string | null;
  /** ISO time of the last server save; a newer copy in this browser wins over it. */
  updatedAt: string;
  theme: StoryTheme;
};
type Props = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  username: string | null;
  initial?: InitialStory;
};
const control =
  "rounded-md border border-border bg-page px-2.5 py-2 text-sm hover:bg-surface disabled:opacity-40";

export default function StoryEditor({
  name,
  email,
  avatarUrl,
  username,
  initial,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [memberOnly, setMemberOnly] = useState(initial?.memberOnly ?? false);
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? null);
  const [theme, setTheme] = useState<StoryTheme>(initial?.theme ?? "classic");
  const [draft, setDraft] = useState<Draft | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState(initial ? "Saved draft" : "New draft");
  const [error, setError] = useState("");
  const [words, setWords] = useState(0);
  const [video, setVideo] = useState("");
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [alt, setAlt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadAsCover = useRef(false);
  // Unpublished writing is mirrored to this browser so a closed tab or crash never loses it.
  const storageKey = localDraftKey(email ?? username ?? "anonymous", initial?.id ?? null);
  const [localRevision, setLocalRevision] = useState(0);
  const restored = useRef(false);
  function changed() {
    setDirty(true);
    setStatus("Unsaved changes");
    setLocalRevision((r) => r + 1);
  }

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, protocols: ["http", "https", "mailto"] },
      }),
      TextStyleKit.configure({ color: false, backgroundColor: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ImageExtension.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: "Tell your story…" }),
      VideoNode,
    ],
    content: initial?.content ?? {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
    editorProps: {
      attributes: {
        class: "story-prose min-h-[440px] outline-none",
        role: "textbox",
        "aria-label": "Story text",
        "aria-multiline": "true",
      },
    },
    onCreate: ({ editor: current }) =>
      setWords(current.getText().trim().split(/\s+/).filter(Boolean).length),
    onUpdate: ({ editor: current }) => {
      changed();
      setWords(current.getText().trim().split(/\s+/).filter(Boolean).length);
    },
  });

  useEffect(() => {
    if (!editor || restored.current) return;
    restored.current = true;
    const saved = readLocalDraft(storageKey);
    if (!saved || (initial && saved.savedAt <= Date.parse(initial.updatedAt))) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore once the editor exists
    setTitle(saved.title);
    setSubtitle(saved.subtitle);
    setMemberOnly(saved.memberOnly);
    setCoverImage(saved.coverImage);
    if (!initial && saved.draft) setDraft(saved.draft);
    editor.commands.setContent(saved.content, { emitUpdate: false });
    setWords(editor.getText().trim().split(/\s+/).filter(Boolean).length);
    setDirty(true);
    setStatus(saved.draft ? "Resumed your draft" : "Restored your unsaved writing");
  }, [editor, initial, storageKey]);

  useEffect(() => {
    if (!editor || localRevision === 0 || !dirty) return;
    const timer = window.setTimeout(() => {
      const copy: LocalDraft = {
        draft,
        title,
        subtitle,
        content: editor.getJSON(),
        memberOnly,
        coverImage,
        savedAt: Date.now(),
      };
      writeLocalDraft(storageKey, copy);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [editor, localRevision, dirty, draft, title, subtitle, memberOnly, coverImage, storageKey]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save(publish: boolean) {
    if (!editor || busy || uploading) return;
    if (!title.trim()) {
      setError("Give your story a title first.");
      return;
    }
    if (publish && editor.isEmpty) {
      setError("Write your story before publishing.");
      return;
    }
    setBusy(true);
    setError("");
    editor.setEditable(false, false);
    try {
      const payload = {
        title: title.trim(),
        subtitle,
        content: editor.getJSON(),
        contentText: editor.getText(),
        memberOnly,
        coverImage,
        theme,
      };
      const response = await fetch(
        draft ? `/api/articles/${draft.id}` : "/api/articles",
        {
          method: draft ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok)
        throw new Error(
          "Could not save your story. Check its length and try again.",
        );
      const saved = (await response.json()) as Draft;
      const article = draft ?? saved;
      setDraft(article);
      setDirty(false);
      setStatus("Saved draft");
      // An existing story's browser copy is no longer needed once the server has it. /new-story keeps its copy,
      // now linked to the saved draft, so reopening /new-story resumes it until it is published.
      if (initial) clearLocalDraft(storageKey);
      else
        writeLocalDraft(storageKey, {
          ...payload,
          draft: article,
          savedAt: Date.now(),
        });
      if (!publish) return;
      const published = await fetch(`/api/articles/${article.id}/publish`, {
        method: "POST",
      });
      if (!published.ok)
        throw new Error("Draft saved. Publishing failed; please retry.");
      clearLocalDraft(storageKey);
      router.push(
        article.author.username
          ? `/${article.author.username}/${article.slug}`
          : "/me/stories",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save. Please retry.",
      );
    } finally {
      setBusy(false);
      editor.setEditable(true, false);
    }
  }

  async function upload(file: File) {
    if (!editor) return;
    setUploading(true);
    setError("");
    const asCover = uploadAsCover.current;
    try {
      const image = await prepareImage(file);
      const bytes = new Uint8Array(await image.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const response = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: image.type,
          data: btoa(binary),
          purpose: asCover ? "cover" : "inline",
        }),
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url)
        throw new Error(result.error ?? "Upload failed.");
      if (asCover) {
        setCoverImage(result.url);
        changed();
      } else
        editor
          .chain()
          .focus()
          .insertContentAt(editor.state.selection.to, {
            type: "image",
            attrs: { src: result.url, alt },
          })
          .run();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function addVideo() {
    if (!editor) return;
    setVideoBusy(true);
    setError("");
    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: video }),
      });
      const result = (await response.json()) as {
        url?: string;
        title?: string;
        thumbnail?: string;
        error?: string;
      };
      if (!response.ok || !result.url)
        throw new Error(result.error ?? "Unable to load video.");
      editor
        .chain()
        .focus()
        .insertContentAt(editor.state.selection.to, {
          type: "video",
          attrs: {
            url: result.url,
            title: result.title,
            thumbnail: result.thumbnail,
          },
        })
        .run();
      setVideo("");
      setVideoOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load video.",
      );
    } finally {
      setVideoBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-page px-4 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Logo wordmark="h-8" />
          <span role="status" className="text-xs text-muted">
            {status}
          </span>
          {!initial && (draft || dirty) && (
            <button
              type="button"
              className="text-xs text-muted underline underline-offset-4 hover:text-foreground"
              disabled={busy}
              onClick={() => {
                // The saved server draft stays in Stories; only this browser's copy is cleared.
                clearLocalDraft(storageKey);
                setDraft(null);
                setTitle("");
                setSubtitle("");
                setMemberOnly(false);
                setCoverImage(null);
                editor?.commands.clearContent(false);
                setWords(0);
                setDirty(false);
                setStatus("New draft");
              }}
            >
              Start a new story
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/me/stories" className="text-sm underline">
            My stories
          </Link>
          <button
            className={control}
            disabled={busy || uploading}
            onClick={() => void save(false)}
          >
            Save draft
          </button>
          <button
            className="rounded-full bg-accent px-5 py-2 text-sm text-accent-foreground disabled:opacity-50"
            disabled={busy || uploading}
            onClick={() => void save(true)}
          >
            {busy ? "Saving…" : "Publish"}
          </button>
          <UserMenu
            name={name}
            email={email}
            avatarUrl={avatarUrl}
            username={username}
          />
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="border-b border-border bg-page px-6 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <main className="mx-auto max-w-[1500px] px-3 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Your writing desk</h1>
            <p className="text-xs text-muted">
              Shape your story, one paragraph at a time.
            </p>
          </div>
          <Link href="/ai-editor" className={control}>
            Open the AI editor
          </Link>
        </div>
        <div className="grid items-start gap-5">
          <section
            className="min-w-0 rounded-xl border border-border bg-page shadow-sm"
            aria-label="Document editor"
          >
            <Ribbon
              editor={editor}
              disabled={busy}
              uploading={uploading || videoBusy}
              theme={theme}
              onTheme={(value) => {
                setTheme(value);
                changed();
              }}
              onInsertImage={() => {
                uploadAsCover.current = false;
                fileRef.current?.click();
              }}
              onUploadCover={() => {
                uploadAsCover.current = true;
                fileRef.current?.click();
              }}
              onToggleVideo={() => setVideoOpen(!videoOpen)}
              onToggleLink={() => {
                setLinkOpen(!linkOpen);
                setLink(String(editor?.getAttributes("link").href ?? ""));
              }}
              videoOpen={videoOpen}
              alt={alt}
              onAlt={setAlt}
            />
            {linkOpen && (
              <form
                className="flex flex-wrap gap-2 border-b border-border p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!safeLink(link)) {
                    setError("Enter an http, https or mailto link.");
                    return;
                  }
                  editor
                    ?.chain()
                    .focus()
                    .extendMarkRange("link")
                    .setLink({ href: link })
                    .run();
                  setLinkOpen(false);
                }}
              >
                <input
                  aria-label="Link URL"
                  placeholder="Paste a link"
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                  className={`${control} min-w-0 flex-1`}
                />
                <button className={control}>Apply link</button>
                <button
                  type="button"
                  className={control}
                  onClick={() => {
                    editor?.chain().focus().unsetLink().run();
                    setLinkOpen(false);
                  }}
                >
                  Remove link
                </button>
              </form>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            {videoOpen && (
              <form
                className="flex flex-wrap gap-2 border-b border-border p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addVideo();
                }}
              >
                <input
                  type="url"
                  required
                  aria-label="Video URL"
                  placeholder="Paste a public YouTube or Vimeo link"
                  value={video}
                  onChange={(event) => setVideo(event.target.value)}
                  className={`${control} min-w-0 flex-1`}
                />
                <button disabled={videoBusy || busy} className={control}>
                  {videoBusy ? "Loading…" : "Insert preview"}
                </button>
              </form>
            )}
            <div className="bg-surface px-2 py-6 sm:px-8 sm:py-10">
              <div
                className="story-theme mx-auto max-w-[850px] rounded-sm border border-border bg-page px-5 py-8 shadow-md sm:px-16 sm:py-14"
                data-story-theme={theme}
              >
                {coverImage && (
                  <div className="mb-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverImage}
                      alt="Story cover"
                      className="max-h-72 w-full rounded-lg object-cover"
                    />
                    <button
                      className="mt-2 text-xs underline"
                      disabled={busy}
                      onClick={() => {
                        setCoverImage(null);
                        changed();
                      }}
                    >
                      Remove cover
                    </button>
                  </div>
                )}
                <input
                  aria-label="Story title"
                  placeholder="Title"
                  maxLength={250}
                  disabled={busy}
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    changed();
                  }}
                  className="story-display mb-3 w-full bg-transparent text-3xl outline-none sm:text-4xl"
                />
                <textarea
                  aria-label="Story subtitle"
                  placeholder="Add a subtitle…"
                  maxLength={500}
                  rows={2}
                  disabled={busy}
                  value={subtitle}
                  onChange={(event) => {
                    setSubtitle(event.target.value);
                    changed();
                  }}
                  className="mb-6 w-full resize-none bg-transparent text-lg text-muted outline-none"
                />
                <EditorContent editor={editor} />
              </div>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 text-xs text-muted">
              <span>
                {words} words · {Math.max(1, Math.ceil(words / 200))} min read
              </span>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={memberOnly}
                  onChange={(event) => {
                    setMemberOnly(event.target.checked);
                    changed();
                  }}
                />
                Members-only story
              </label>
              {draft && (
                <Link href={`/editor/${draft.id}`} className="underline">
                  Draft link
                </Link>
              )}
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}
