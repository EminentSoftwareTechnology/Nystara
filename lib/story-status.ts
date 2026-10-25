import { prisma } from "@/lib/prisma";

export const STORY_TABS = [
  "drafts",
  "scheduled",
  "published",
  "unlisted",
  "submissions",
] as const;
export type StoryTab = (typeof STORY_TABS)[number];

export function storyTab(value: string | undefined): StoryTab {
  return STORY_TABS.find((tab) => tab === value) ?? "drafts";
}

export async function publishDueStories() {
  const now = new Date();
  await prisma.$executeRaw`UPDATE "Article" SET published = true, "publishedAt" = "scheduledAt", "scheduledAt" = NULL, "submittedAt" = NULL, "updatedAt" = ${now} WHERE published = false AND "scheduledAt" <= ${now}`;
}
