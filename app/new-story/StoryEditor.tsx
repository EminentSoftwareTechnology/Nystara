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
import {
  FONT_FAMILIES,
  FONT_SIZES,
  legacyDocument,
  safeLink,
} from "@/lib/story-document";
import { AI_ACTIONS } from "@/lib/ai-editor";

type Draft = { id: string; slug: string; author: { username: string | null } };
export type InitialStory = Draft & {
  title: string;
  subtitle: string | null;
  content: JSONContent;
  memberOnly: boolean;
  coverImage: string | null;
};
type Props = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  username: string | null;
  premium: boolean;
  initial?: InitialStory;
};
const control =
  "rounded-md border border-border bg-page px-2.5 py-2 text-sm hover:bg-surface disabled:opacity-40";

export default function StoryEditor({
  name,
  email,
  avatarUrl,
  username,
  premium,
  initial,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [memberOnly, setMemberOnly] = useState(initial?.memberOnly ?? false);
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? null);
  const [draft, setDraft] = useState<Draft | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState(initial ? "Saved draft" : "New draft");
  const [error, setError] = useState("");
  const [words, setWords] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAction, setAiAction] = useState<keyof typeof AI_ACTIONS>("polish");
  const [suggestion, setSuggestion] = useState("");
  const [video, setVideo] = useState("");
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [alt, setAlt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadAsCover = useRef(false);
  const revision = useRef(0);
  const [aiSelection, setAiSelection] = useState<{
    from: number;
    to: number;
    revision: number;
  } | null>(null);
  function changed() {
    revision.current++;
    setDirty(true);
    setStatus("Unsaved changes");
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
      if (!publish) return;
      const published = await fetch(`/api/articles/${article.id}/publish`, {
        method: "POST",
      });
      if (!published.ok)
        throw new Error("Draft saved. Publishing failed; please retry.");
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
    if (
      file.size > 600 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Choose a JPEG, PNG or WebP image up to 600 KB.");
      return;
    }
    setUploading(true);
    setError("");
    const asCover = uploadAsCover.current;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const response = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: file.type, data: btoa(binary) }),
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

  async function askAi() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text =
      from === to
        ? editor.getText() || title
        : editor.state.doc.textBetween(from, to, "\n");
    if (!text.trim() || text.length > 12000) {
      setError(
        "Select a passage of up to 12,000 characters, or write a shorter draft first.",
      );
      return;
    }
    setAiSelection({ from, to, revision: revision.current });
    setAiBusy(true);
    setSuggestion("");
    setError("");
    try {
      const response = await fetch("/api/ai/editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: aiAction, text }),
      });
      const result = (await response.json()) as {
        text?: string;
        error?: string;
      };
      if (!response.ok || !result.text)
        throw new Error(result.error ?? "AI request failed.");
      setSuggestion(result.text);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI request failed.");
    } finally {
      setAiBusy(false);
    }
  }

  function applySuggestion(replace: boolean) {
    if (!editor || !suggestion) return;
    const selection = aiSelection;
    if (
      replace &&
      (!selection ||
        selection.from === selection.to ||
        revision.current !== selection.revision)
    ) {
      setError(
        "The passage has changed. Request a new suggestion before replacing it.",
      );
      return;
    }
    const content = legacyDocument(suggestion).content ?? [];
    editor
      .chain()
      .focus()
      .insertContentAt(
        replace && selection
          ? { from: selection.from, to: selection.to }
          : editor.state.doc.content.size,
        content,
      )
      .run();
    setSuggestion("");
  }

  function tool(
    label: string,
    action: () => void,
    active = false,
    disabled = false,
  ) {
    return (
      <button
        type="button"
        key={label}
        title={label}
        aria-label={label}
        aria-pressed={active}
        disabled={disabled || busy}
        onMouseDown={(event) => event.preventDefault()}
        onClick={action}
        className={`${control} ${active ? "bg-surface ring-1 ring-foreground" : ""}`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-page px-4 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Logo wordmark="h-8" />
          <span role="status" className="text-xs text-muted">
            {status}
          </span>
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
          <button
            className={control}
            onClick={() => setAiOpen(!aiOpen)}
            aria-expanded={aiOpen}
          >
            AI editor · Premium
          </button>
        </div>
        <div
          className={`grid items-start gap-5 ${aiOpen ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""}`}
        >
          <section
            className="min-w-0 rounded-xl border border-border bg-page shadow-sm"
            aria-label="Document editor"
          >
            <fieldset
              disabled={busy}
              className="flex flex-wrap items-center gap-2 border-b border-border p-3"
              aria-label="Text formatting"
            >
              <select
                aria-label="Paragraph style"
                className={control}
                value={
                  editor?.isActive("heading")
                    ? String(editor.getAttributes("heading").level)
                    : "paragraph"
                }
                onChange={(event) =>
                  event.target.value === "paragraph"
                    ? editor?.chain().focus().setParagraph().run()
                    : editor
                        ?.chain()
                        .focus()
                        .setHeading({
                          level: Number(event.target.value) as 1 | 2 | 3,
                        })
                        .run()
                }
              >
                <option value="paragraph">Normal text</option>
                <option value="1">Heading 1</option>
                <option value="2">Heading 2</option>
                <option value="3">Heading 3</option>
              </select>
              <select
                aria-label="Font family"
                className={control}
                value={String(
                  editor?.getAttributes("textStyle").fontFamily ?? "Georgia",
                )}
                onChange={(event) =>
                  editor
                    ?.chain()
                    .focus()
                    .setFontFamily(event.target.value)
                    .run()
                }
              >
                {FONT_FAMILIES.map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
              <select
                aria-label="Font size"
                className={control}
                value={String(
                  editor?.getAttributes("textStyle").fontSize ?? "20px",
                )}
                onChange={(event) =>
                  editor?.chain().focus().setFontSize(event.target.value).run()
                }
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size.replace("px", "")}
                  </option>
                ))}
              </select>
              {tool(
                "Bold",
                () => editor?.chain().focus().toggleBold().run(),
                editor?.isActive("bold"),
              )}
              {tool(
                "Italic",
                () => editor?.chain().focus().toggleItalic().run(),
                editor?.isActive("italic"),
              )}
              {tool(
                "Underline",
                () => editor?.chain().focus().toggleUnderline().run(),
                editor?.isActive("underline"),
              )}
              {tool(
                "Strike",
                () => editor?.chain().focus().toggleStrike().run(),
                editor?.isActive("strike"),
              )}
              {["left", "center", "right", "justify"].map((align) =>
                tool(
                  `Align ${align}`,
                  () => editor?.chain().focus().setTextAlign(align).run(),
                  editor?.isActive({ textAlign: align }),
                ),
              )}
              <select
                aria-label="Line spacing"
                className={control}
                value={String(
                  editor?.getAttributes("textStyle").lineHeight ?? "1.8",
                )}
                onChange={(event) =>
                  editor
                    ?.chain()
                    .focus()
                    .setLineHeight(event.target.value)
                    .run()
                }
              >
                <option value="1.5">Spacing 1.5</option>
                <option value="1.8">Spacing 1.8</option>
                <option value="2">Double spacing</option>
              </select>
              {tool(
                "Bullets",
                () => editor?.chain().focus().toggleBulletList().run(),
                editor?.isActive("bulletList"),
              )}
              {tool(
                "Numbered list",
                () => editor?.chain().focus().toggleOrderedList().run(),
                editor?.isActive("orderedList"),
              )}
              {tool(
                "Quote",
                () => editor?.chain().focus().toggleBlockquote().run(),
                editor?.isActive("blockquote"),
              )}
              {tool(
                "Code",
                () => editor?.chain().focus().toggleCodeBlock().run(),
                editor?.isActive("codeBlock"),
              )}
              {tool("Divider", () =>
                editor?.chain().focus().setHorizontalRule().run(),
              )}
              {tool(
                "Link",
                () => {
                  setLinkOpen(!linkOpen);
                  setLink(String(editor?.getAttributes("link").href ?? ""));
                },
                editor?.isActive("link"),
              )}
              {tool("Clear formatting", () =>
                editor?.chain().focus().unsetAllMarks().clearNodes().run(),
              )}
              {tool(
                "Undo",
                () => editor?.chain().focus().undo().run(),
                false,
                !editor?.can().undo(),
              )}
              {tool(
                "Redo",
                () => editor?.chain().focus().redo().run(),
                false,
                !editor?.can().redo(),
              )}
            </fieldset>
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
            <fieldset
              disabled={busy || uploading || videoBusy}
              className="flex flex-wrap gap-2 border-b border-border p-3"
              aria-label="Insert media"
            >
              <input
                aria-label="Image description"
                placeholder="Image description (alt text)"
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                className={`${control} w-56`}
                maxLength={500}
              />
              <button
                type="button"
                className={control}
                onClick={() => {
                  uploadAsCover.current = false;
                  fileRef.current?.click();
                }}
              >
                {uploading ? "Uploading…" : "Insert image"}
              </button>
              <button
                type="button"
                className={control}
                onClick={() => {
                  uploadAsCover.current = true;
                  fileRef.current?.click();
                }}
              >
                Upload cover
              </button>
              <button
                type="button"
                className={control}
                aria-expanded={videoOpen}
                onClick={() => setVideoOpen(!videoOpen)}
              >
                Insert video link
              </button>
              <span className="self-center text-xs text-muted">
                JPEG, PNG, WebP · 600 KB max
              </span>
            </fieldset>
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
            <div className="mx-auto max-w-4xl px-5 py-8 sm:px-12 sm:py-12">
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
                className="mb-3 w-full bg-transparent text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
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
          {aiOpen && (
            <aside
              className="rounded-xl border border-border bg-page p-5"
              aria-label="AI editor"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Premium writing companion
              </span>
              <h2 className="mt-2 text-xl font-semibold">Keep your voice.</h2>
              <p className="my-3 text-sm leading-6 text-muted">
                Polish a passage, find a stronger title, or work through your
                next idea. Review every suggestion before adding it.
              </p>
              {premium ? (
                <>
                  <label className="text-sm">
                    Editing action
                    <select
                      value={aiAction}
                      onChange={(event) =>
                        setAiAction(
                          event.target.value as keyof typeof AI_ACTIONS,
                        )
                      }
                      className={`${control} mt-2 w-full`}
                    >
                      {Object.keys(AI_ACTIONS).map((action) => (
                        <option key={action} value={action}>
                          {action[0].toUpperCase() + action.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="my-3 text-xs leading-5 text-muted">
                    Select text to edit a passage, or use the draft. Clicking
                    Generate sends that text to OpenAI. Up to 12,000 characters
                    and 30 requests per day.
                  </p>
                  <button
                    className={`${control} w-full`}
                    disabled={aiBusy || busy}
                    onClick={() => void askAi()}
                  >
                    {aiBusy ? "Thinking…" : "Generate suggestion"}
                  </button>
                  {suggestion && (
                    <div className="mt-4">
                      <label className="text-sm">
                        Suggestion
                        <textarea
                          aria-label="AI suggestion"
                          value={suggestion}
                          onChange={(event) =>
                            setSuggestion(event.target.value)
                          }
                          rows={12}
                          className={`${control} mt-2 w-full`}
                        />
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          className={control}
                          disabled={busy}
                          onClick={() => applySuggestion(false)}
                        >
                          Append to story
                        </button>
                        <button
                          className={control}
                          disabled={
                            busy ||
                            !aiSelection ||
                            aiSelection.from === aiSelection.to
                          }
                          onClick={() => applySuggestion(true)}
                        >
                          Replace selection
                        </button>
                        <button
                          className={control}
                          onClick={() => setSuggestion("")}
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="rounded-lg bg-background p-4 text-sm leading-6">
                  AI editing requires an active premium membership. Premium
                  billing is not available yet; the document editor is free to
                  use.
                </p>
              )}
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
