import type { NextRequest } from "next/server";

// ~100k chars is well beyond a long-form article; caps DB row size and parse cost.
export const MAX_CONTENT_CHARS = 100_000;

// Malformed JSON yields null so the zod schema rejects it with a 400 instead of a 500.
export async function readJson(req: NextRequest): Promise<unknown> {
  return req.json().catch(() => null);
}

export function parsePage(raw: string | null | undefined): number {
  return Math.max(1, parseInt(raw ?? "1", 10) || 1);
}
