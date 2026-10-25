import { z } from "zod";
import { MAX_CONTENT_CHARS } from "@/lib/request";

export const articleContent = z
  .record(z.string(), z.unknown())
  .refine((v) => JSON.stringify(v).length <= MAX_CONTENT_CHARS * 2, "content too large");

// https only: blocks data:/javascript: URIs and plain-http trackers on reader IPs.
export const coverImageUrl = z
  .string()
  .max(2048)
  .url()
  .refine((u) => u.startsWith("https://"), "cover image must be an https URL");
