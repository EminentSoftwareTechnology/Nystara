import { z } from "zod";
import { MAX_CONTENT_CHARS } from "@/lib/request";
import { storyNode, documentText } from "@/lib/story-document";
import { isStorageImage } from "@/lib/storage-url";
import { safeVideoThumbnail } from "@/lib/video";

function boundedContent(value: Record<string, unknown>): boolean {
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++nodes > 5000 || item.depth > 20) return false;
    if (item.value && typeof item.value === "object") {
      for (const child of Object.values(item.value))
        stack.push({ value: child, depth: item.depth + 1 });
    }
  }
  return JSON.stringify(value).length <= MAX_CONTENT_CHARS * 2;
}

export const articleContent = z
  .record(z.string(), z.unknown())
  .refine(boundedContent, "content too large or deeply nested")
  .superRefine((value, ctx) => {
    if (!boundedContent(value)) return;
    if (value.type !== "doc" || !Array.isArray(value.content)) return;
    const result = storyNode.safeParse(value);
    if (!result.success) {
      ctx.addIssue({ code: "custom", message: "Invalid story document" });
      return;
    }
    if (documentText(result.data).length > MAX_CONTENT_CHARS)
      ctx.addIssue({ code: "custom", message: "Story text is too long" });
    const stack = [result.data];
    while (stack.length) {
      const node = stack.pop()!;
      if (
        node.type === "image" &&
        (!node.attrs?.src || !isStorageImage(node.attrs.src))
      )
        ctx.addIssue({ code: "custom", message: "Invalid story image" });
      if (
        node.type === "video" &&
        (!node.attrs?.url ||
          (node.attrs.thumbnail && !safeVideoThumbnail(node.attrs.thumbnail)))
      )
        ctx.addIssue({ code: "custom", message: "Invalid video preview" });
      stack.push(...(node.content ?? []));
    }
  });

// https only: blocks data:/javascript: URIs and plain-http trackers on reader IPs.
export const coverImageUrl = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === "lh3.googleusercontent.com" ||
        url.hostname === "avatars.githubusercontent.com" ||
        /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname) ||
        isStorageImage(value))
    );
  }, "cover image host is not allowed");
