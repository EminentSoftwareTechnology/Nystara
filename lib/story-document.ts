import { z } from "zod";
import { videoUrl } from "./video";

export const FONT_FAMILIES = [
  "Georgia",
  "Arial",
  "Verdana",
  "Times New Roman",
  "Courier New",
] as const;
export const FONT_SIZES = [
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
] as const;

export const LINE_HEIGHTS = ["1.5", "1.8", "2"] as const;

const TEXT_STYLES: Record<string, readonly string[]> = {
  fontFamily: FONT_FAMILIES,
  fontSize: FONT_SIZES,
  lineHeight: LINE_HEIGHTS,
};

/** Pasted text keeps the source page's fonts; clear any the story schema would reject. */
export function dropUnsupportedTextStyles<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc), (key: string, value: unknown) =>
    key in TEXT_STYLES &&
    typeof value === "string" &&
    !TEXT_STYLES[key].includes(value)
      ? null
      : value,
  );
}

export function safeLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ["https:", "http:", "mailto:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export const storyMark = z.object({
  type: z.enum([
    "bold",
    "italic",
    "underline",
    "strike",
    "code",
    "link",
    "textStyle",
  ]),
  attrs: z
    .object({
      href: z.string().max(2048).refine(safeLink).optional(),
      target: z.string().nullable().optional(),
      rel: z.string().nullable().optional(),
      class: z.string().nullable().optional(),
      fontFamily: z.enum(FONT_FAMILIES).nullable().optional(),
      fontSize: z.enum(FONT_SIZES).nullable().optional(),
      lineHeight: z.enum(LINE_HEIGHTS).nullable().optional(),
    })
    .optional(),
});

export type StoryNode = {
  type:
    | "doc"
    | "paragraph"
    | "heading"
    | "text"
    | "bulletList"
    | "orderedList"
    | "listItem"
    | "blockquote"
    | "codeBlock"
    | "hardBreak"
    | "horizontalRule"
    | "image"
    | "video";
  text?: string;
  attrs?: {
    level?: number;
    textAlign?: "left" | "center" | "right" | "justify" | null;
    start?: number;
    src?: string;
    alt?: string | null;
    title?: string | null;
    url?: string;
    thumbnail?: string;
    language?: string | null;
  };
  marks?: z.infer<typeof storyMark>[];
  content?: StoryNode[];
};

// Media sources are checked separately against server configuration before persistence/rendering.
export const storyNode: z.ZodType<StoryNode> = z.lazy(() =>
  z.object({
    type: z.enum([
      "doc",
      "paragraph",
      "heading",
      "text",
      "bulletList",
      "orderedList",
      "listItem",
      "blockquote",
      "codeBlock",
      "hardBreak",
      "horizontalRule",
      "image",
      "video",
    ]),
    text: z.string().optional(),
    attrs: z
      .object({
        level: z.number().int().min(1).max(3).optional(),
        textAlign: z
          .enum(["left", "center", "right", "justify"])
          .nullable()
          .optional(),
        start: z.number().int().min(1).max(10000).optional(),
        src: z.string().max(2048).optional(),
        alt: z.string().max(500).nullable().optional(),
        title: z.string().max(500).nullable().optional(),
        url: videoUrl.optional(),
        thumbnail: z.string().max(2048).optional(),
        language: z.string().max(50).nullable().optional(),
      })
      .optional(),
    marks: z.array(storyMark).max(10).optional(),
    content: z.array(storyNode).max(5000).optional(),
  }),
);

export function documentText(node: StoryNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const children = node.content ?? [];
  return children
    .map(documentText)
    .join(["paragraph", "heading"].includes(node.type) ? "" : "\n");
}

export function legacyDocument(text: string): StoryNode {
  return {
    type: "doc",
    content: text
      .split(/\n\n+/)
      .map((paragraph) => ({
        type: "paragraph",
        content: paragraph ? [{ type: "text", text: paragraph }] : [],
      })),
  };
}
