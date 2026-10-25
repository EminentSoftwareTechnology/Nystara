import { z } from "zod";

export const commentInput = z.object({
  body: z.string().trim().min(1).max(2000),
  guestName: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u, "Use letters, spaces, apostrophes, dots or hyphens")
    .optional(),
  parentId: z.string().max(40).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

export const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  guestName: true,
  parentId: true,
  authorId: true,
  author: { select: { name: true, username: true, avatarUrl: true, image: true } },
} as const;

export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  guest: boolean;
  parentId: string | null;
  canDelete: boolean;
};

type CommentRow = {
  id: string;
  body: string;
  createdAt: Date;
  guestName: string | null;
  parentId: string | null;
  authorId: string | null;
  author: { name: string | null; username: string | null; avatarUrl: string | null; image?: string | null } | null;
};

export function toCommentView(
  row: CommentRow,
  viewer: { userId: string | null; articleAuthorId: string },
): CommentView {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    name: row.author?.name ?? row.author?.username ?? row.guestName ?? "Reader",
    username: row.author?.username ?? null,
    avatarUrl: row.author?.avatarUrl ?? row.author?.image ?? null,
    guest: !row.authorId,
    parentId: row.parentId,
    canDelete:
      viewer.userId !== null &&
      (viewer.userId === row.authorId || viewer.userId === viewer.articleAuthorId),
  };
}
