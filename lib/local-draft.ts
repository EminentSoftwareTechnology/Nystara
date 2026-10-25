import type { JSONContent } from "@tiptap/react";

/** An unpublished story kept in this browser so closing the tab never loses writing. */
export type LocalDraft = {
  /** The server draft this belongs to, once it has been saved at least once. */
  draft: { id: string; slug: string; author: { username: string | null } } | null;
  title: string;
  subtitle: string;
  content: JSONContent;
  memberOnly: boolean;
  coverImage: string | null;
  savedAt: number;
};

/** `storyId` null is the single in-progress story behind /new-story. Keys are per account on shared browsers. */
export function localDraftKey(owner: string, storyId: string | null): string {
  return `nystara:draft:${owner}:${storyId ?? "new"}`;
}

export function readLocalDraft(key: string): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("content" in value) ||
      !value.content ||
      typeof value.content !== "object" ||
      !("type" in value.content) ||
      value.content.type !== "doc"
    )
      return null;
    return value as LocalDraft;
  } catch {
    return null;
  }
}

export function writeLocalDraft(key: string, draft: LocalDraft): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage full or blocked (private mode): the server draft is still the source of truth.
  }
}

export function clearLocalDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}
