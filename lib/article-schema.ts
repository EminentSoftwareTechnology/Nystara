import { z } from "zod";
import { MAX_CONTENT_CHARS } from "@/lib/request";

function boundedContent(value: Record<string, unknown>): boolean {
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++nodes > 5000 || item.depth > 20) return false;
    if (item.value && typeof item.value === "object") {
      for (const child of Object.values(item.value)) stack.push({ value: child, depth: item.depth + 1 });
    }
  }
  return JSON.stringify(value).length <= MAX_CONTENT_CHARS * 2;
}

export const articleContent = z
  .record(z.string(), z.unknown())
  .refine(boundedContent, "content too large or deeply nested");

// https only: blocks data:/javascript: URIs and plain-http trackers on reader IPs.
export const coverImageUrl = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (url.hostname === "lh3.googleusercontent.com" || url.hostname === "avatars.githubusercontent.com" ||
       /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname));
  }, "cover image host is not allowed");
