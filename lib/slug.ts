import { randomUUID } from "node:crypto";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateUniqueSlug(title: string): string {
  return `${slugify(title) || "untitled"}-${randomUUID()}`;
}
