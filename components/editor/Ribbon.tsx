"use client";

import { useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { FONT_FAMILIES, FONT_SIZES } from "@/lib/story-document";
import { STORY_THEMES, type StoryTheme } from "@/lib/story-theme";

type Props = {
  editor: Editor | null;
  disabled: boolean;
  uploading: boolean;
  theme: StoryTheme;
  onTheme: (theme: StoryTheme) => void;
  onInsertImage: () => void;
  onUploadCover: () => void;
  onToggleVideo: () => void;
  onToggleLink: () => void;
  videoOpen: boolean;
  alt: string;
  onAlt: (value: string) => void;
};

type Tab = "home" | "insert" | "design";

const DEFAULT_SIZE = "20px";
const select =
  "h-8 rounded border border-border bg-page px-2 text-[13px] hover:border-border-strong disabled:opacity-40";

function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {children}
    </svg>
  );
}

const icons = {
  undo: <Svg><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></Svg>,
  redo: <Svg><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" /></Svg>,
  bold: <Svg><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" /></Svg>,
  italic: <Svg><path d="M14 5h-4M14 19h-4M14 5l-4 14" /></Svg>,
  underline: <Svg><path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14" /></Svg>,
  strike: <Svg><path d="M5 12h14M16 7a4 3 0 0 0-4-2c-2.2 0-4 1.3-4 3 0 1.3 1 2.3 2.7 2.8M8 17a4 3 0 0 0 4 2c2.2 0 4-1.3 4-3 0-.7-.2-1.3-.7-1.8" /></Svg>,
  code: <Svg><path d="m8 7-5 5 5 5M16 7l5 5-5 5" /></Svg>,
  grow: <Svg><path d="M3 19 8 6l5 13M5 15h6M17 11V5M14 8h6" /></Svg>,
  shrink: <Svg><path d="M3 19 8 6l5 13M5 15h6M14 8h6" /></Svg>,
  clear: <Svg><path d="M4 7V5h12v2M10 5l-3 14M13 13l6 6M19 13l-6 6" /></Svg>,
  bullets: <Svg><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></Svg>,
  numbers: <Svg><path d="M10 6h10M10 12h10M10 18h10M4 4.5 5 4v4M4 14h2l-2 3h2M4 20h2" /></Svg>,
  outdent: <Svg><path d="M21 5H3M21 19H3M21 12h-9M7 9l-3 3 3 3" /></Svg>,
  indent: <Svg><path d="M21 5H3M21 19H3M21 12h-9M4 9l3 3-3 3" /></Svg>,
  left: <Svg><path d="M3 5h18M3 10h12M3 15h18M3 20h12" /></Svg>,
  center: <Svg><path d="M3 5h18M6 10h12M3 15h18M6 20h12" /></Svg>,
  right: <Svg><path d="M3 5h18M9 10h12M3 15h18M9 20h12" /></Svg>,
  justify: <Svg><path d="M3 5h18M3 10h18M3 15h18M3 20h18" /></Svg>,
  image: <Svg size={26}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></Svg>,
  cover: <Svg size={26}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 12h18" /><path d="m3 10 4-4 4 4 3-3 7 7" /></Svg>,
  video: <Svg size={26}><rect x="2" y="5" width="15" height="14" rx="2" /><path d="m17 10 5-3v10l-5-3z" /></Svg>,
  link: <Svg size={26}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></Svg>,
  divider: <Svg size={26}><path d="M3 12h18M7 6h10M7 18h10" /></Svg>,
  quote: <Svg size={26}><path d="M7 7H4v6h4v-3c0-2-1-3-3-3M17 7h-3v6h4v-3c0-2-1-3-3-3" /><path d="M8 13c0 2-1 4-4 4M18 13c0 2-1 4-4 4" /></Svg>,
  codeBlock: <Svg size={26}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m9 10-2 2 2 2M15 10l2 2-2 2" /></Svg>,
};

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 flex-col justify-between border-r border-border px-3 last:border-r-0">
      <div className="flex min-h-[64px] flex-wrap items-center gap-1">{children}</div>
      <span className="pt-1 text-center text-[11px] text-muted">{label}</span>
    </div>
  );
}

export default function Ribbon({
  editor,
  disabled,
  uploading,
  theme,
  onTheme,
  onInsertImage,
  onUploadCover,
  onToggleVideo,
  onToggleLink,
  videoOpen,
  alt,
  onAlt,
}: Props) {
  const [tab, setTab] = useState<Tab>("home");
  const chain = () => editor?.chain().focus();
  const size = String(editor?.getAttributes("textStyle").fontSize ?? DEFAULT_SIZE);
  const sizeIndex = FONT_SIZES.findIndex((value) => value === size);

  function step(delta: number) {
    const index = Math.min(FONT_SIZES.length - 1, Math.max(0, (sizeIndex === -1 ? 3 : sizeIndex) + delta));
    chain()?.setFontSize(FONT_SIZES[index]).run();
  }

  function small(label: string, icon: ReactNode, action: () => void, active = false, off = false) {
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={active}
        disabled={disabled || off}
        onMouseDown={(event) => event.preventDefault()}
        onClick={action}
        className={`flex h-8 w-8 items-center justify-center rounded transition-colors disabled:opacity-35 ${active ? "bg-surface-2 ring-1 ring-border-strong" : "hover:bg-surface"}`}
      >
        {icon}
      </button>
    );
  }

  function large(label: string, icon: ReactNode, action: () => void, active = false, off = false) {
    return (
      <button
        type="button"
        title={label}
        aria-pressed={active}
        disabled={disabled || off}
        onMouseDown={(event) => event.preventDefault()}
        onClick={action}
        className={`flex h-[64px] min-w-[60px] flex-col items-center justify-center gap-1 rounded px-2 text-[12px] leading-tight transition-colors disabled:opacity-35 ${active ? "bg-surface-2" : "hover:bg-surface"}`}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  }

  const styles = [
    { label: "Normal", sample: "AaBbCcDd", active: !!editor?.isActive("paragraph") && !editor.isActive("blockquote"), apply: () => chain()?.setParagraph().run(), className: "story-prose !text-[13px] !leading-tight" },
    { label: "Heading 1", sample: "AaBbCc", active: !!editor?.isActive("heading", { level: 1 }), apply: () => chain()?.setHeading({ level: 1 }).run(), className: "story-display text-[20px] leading-tight text-[var(--story-accent,inherit)]" },
    { label: "Heading 2", sample: "AaBbCcD", active: !!editor?.isActive("heading", { level: 2 }), apply: () => chain()?.setHeading({ level: 2 }).run(), className: "story-display text-[17px] leading-tight" },
    { label: "Heading 3", sample: "AaBbCcDd", active: !!editor?.isActive("heading", { level: 3 }), apply: () => chain()?.setHeading({ level: 3 }).run(), className: "story-display text-[14px] leading-tight text-[var(--story-accent,inherit)]" },
    { label: "Quote", sample: "AaBbCcDd", active: !!editor?.isActive("blockquote"), apply: () => chain()?.toggleBlockquote().run(), className: "story-prose !text-[13px] italic text-muted" },
    { label: "Code", sample: "AaBbCc", active: !!editor?.isActive("codeBlock"), apply: () => chain()?.toggleCodeBlock().run(), className: "font-mono text-[12px]" },
  ];

  return (
    <div className="border-b border-border bg-background">
      <div role="tablist" aria-label="Editor ribbon" className="flex gap-1 px-3 pt-2">
        {(["home", "insert", "design"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-t-md px-4 py-1.5 text-[13px] capitalize transition-colors ${tab === value ? "bg-page font-semibold shadow-[0_-1px_0_var(--border)_inset]" : "text-muted hover:text-foreground"}`}
          >
            {value}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={`${tab} tools`} className="flex overflow-x-auto bg-page py-2">
        {tab === "home" && (
          <>
            <Group label="History">
              {small("Undo", icons.undo, () => chain()?.undo().run(), false, !editor?.can().undo())}
              {small("Redo", icons.redo, () => chain()?.redo().run(), false, !editor?.can().redo())}
            </Group>
            <Group label="Font">
              <div className="flex w-[300px] flex-col gap-1">
                <div className="flex items-center gap-1">
                  <select
                    aria-label="Font family"
                    disabled={disabled}
                    className={`${select} w-36`}
                    value={String(editor?.getAttributes("textStyle").fontFamily ?? "")}
                    onChange={(event) =>
                      event.target.value
                        ? chain()?.setFontFamily(event.target.value).run()
                        : chain()?.unsetFontFamily().run()
                    }
                  >
                    <option value="">Theme font</option>
                    {FONT_FAMILIES.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Font size"
                    disabled={disabled}
                    className={`${select} w-16`}
                    value={sizeIndex === -1 ? DEFAULT_SIZE : size}
                    onChange={(event) => chain()?.setFontSize(event.target.value).run()}
                  >
                    {FONT_SIZES.map((value) => (
                      <option key={value} value={value}>
                        {value.replace("px", "")}
                      </option>
                    ))}
                  </select>
                  {small("Increase font size", icons.grow, () => step(1), false, sizeIndex === FONT_SIZES.length - 1)}
                  {small("Decrease font size", icons.shrink, () => step(-1), false, sizeIndex === 0)}
                  {small("Clear formatting", icons.clear, () => chain()?.unsetAllMarks().clearNodes().run())}
                </div>
                <div className="flex items-center gap-0.5">
                  {small("Bold", icons.bold, () => chain()?.toggleBold().run(), editor?.isActive("bold"))}
                  {small("Italic", icons.italic, () => chain()?.toggleItalic().run(), editor?.isActive("italic"))}
                  {small("Underline", icons.underline, () => chain()?.toggleUnderline().run(), editor?.isActive("underline"))}
                  {small("Strikethrough", icons.strike, () => chain()?.toggleStrike().run(), editor?.isActive("strike"))}
                  {small("Inline code", icons.code, () => chain()?.toggleCode().run(), editor?.isActive("code"))}
                </div>
              </div>
            </Group>
            <Group label="Paragraph">
              <div className="flex w-[260px] flex-col gap-1">
                <div className="flex items-center gap-0.5">
                  {small("Bullets", icons.bullets, () => chain()?.toggleBulletList().run(), editor?.isActive("bulletList"))}
                  {small("Numbering", icons.numbers, () => chain()?.toggleOrderedList().run(), editor?.isActive("orderedList"))}
                  {small("Decrease indent", icons.outdent, () => chain()?.liftListItem("listItem").run(), false, !editor?.can().liftListItem("listItem"))}
                  {small("Increase indent", icons.indent, () => chain()?.sinkListItem("listItem").run(), false, !editor?.can().sinkListItem("listItem"))}
                  <select
                    aria-label="Line spacing"
                    title="Line spacing"
                    disabled={disabled}
                    className={`${select} ml-1 w-[72px]`}
                    value={String(editor?.getAttributes("textStyle").lineHeight ?? "1.8")}
                    onChange={(event) => chain()?.setLineHeight(event.target.value).run()}
                  >
                    <option value="1.5">1.5</option>
                    <option value="1.8">1.8</option>
                    <option value="2">2.0</option>
                  </select>
                </div>
                <div className="flex items-center gap-0.5">
                  {(["left", "center", "right", "justify"] as const).map((align) =>
                    small(`Align ${align}`, icons[align], () => chain()?.setTextAlign(align).run(), editor?.isActive({ textAlign: align })),
                  )}
                </div>
              </div>
            </Group>
            <Group label="Styles">
              <div className="story-theme flex gap-1.5" data-story-theme={theme}>
                {styles.map((style) => (
                  <button
                    key={style.label}
                    type="button"
                    disabled={disabled}
                    aria-pressed={style.active}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={style.apply}
                    className={`flex h-[64px] w-[92px] flex-col justify-between overflow-hidden rounded border bg-page px-2 py-1.5 text-left transition-colors disabled:opacity-40 ${style.active ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-border-strong"}`}
                  >
                    <span className={`block truncate ${style.className}`}>{style.sample}</span>
                    <span className="text-[11px] text-muted">{style.label}</span>
                  </button>
                ))}
              </div>
            </Group>
          </>
        )}

        {tab === "insert" && (
          <>
            <Group label="Media">
              {large(uploading ? "Uploading…" : "Picture", icons.image, onInsertImage, false, uploading)}
              {large("Cover", icons.cover, onUploadCover, false, uploading)}
              {large("Video", icons.video, onToggleVideo, videoOpen)}
              <label className="ml-1 flex flex-col text-[11px] text-muted">
                Picture description
                <input
                  aria-label="Image description"
                  placeholder="Alt text for the next picture"
                  value={alt}
                  onChange={(event) => onAlt(event.target.value)}
                  maxLength={500}
                  className={`${select} mt-1 w-52 text-foreground`}
                />
              </label>
            </Group>
            <Group label="Links">
              {large("Link", icons.link, onToggleLink, editor?.isActive("link"))}
            </Group>
            <Group label="Blocks">
              {large("Divider", icons.divider, () => chain()?.setHorizontalRule().run())}
              {large("Quote", icons.quote, () => chain()?.toggleBlockquote().run(), editor?.isActive("blockquote"))}
              {large("Code block", icons.codeBlock, () => chain()?.toggleCodeBlock().run(), editor?.isActive("codeBlock"))}
            </Group>
            <Group label="Pictures">
              <p className="max-w-[220px] text-[11px] leading-snug text-muted">
                Large photos are shrunk in your browser, then checked, resized and saved as WebP.
              </p>
            </Group>
          </>
        )}

        {tab === "design" && (
          <Group label="Document themes">
            <div className="flex gap-2">
              {STORY_THEMES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={theme === option.id}
                  title={`${option.label} theme`}
                  onClick={() => onTheme(option.id)}
                  data-story-theme={option.id}
                  className={`story-theme flex h-[88px] w-[104px] flex-col overflow-hidden rounded border bg-page p-2 text-left transition-colors disabled:opacity-40 ${theme === option.id ? "border-foreground ring-2 ring-foreground" : "border-border hover:border-border-strong"}`}
                >
                  <span className="story-display block truncate text-[15px] leading-tight">Title</span>
                  <span className="story-display mt-1 block truncate text-[10px] leading-tight text-[var(--story-accent,inherit)]">
                    Heading 1
                  </span>
                  <span className="mt-1 block text-[8px] leading-[1.35] text-muted [font-family:var(--story-body)]">
                    On the Design tab, themes coordinate the look of your story.
                  </span>
                  <span className="mt-auto text-[11px] font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </Group>
        )}
      </div>
    </div>
  );
}
