import { z } from "zod";

// Document themes, like Word's Design gallery. Each id maps to a [data-story-theme] block in globals.css.
export const STORY_THEMES = [
  { id: "classic", label: "Classic" },
  { id: "modern", label: "Modern" },
  { id: "editorial", label: "Editorial" },
  { id: "elegant", label: "Elegant" },
  { id: "bold", label: "Bold" },
  { id: "technical", label: "Technical" },
] as const;

export type StoryTheme = (typeof STORY_THEMES)[number]["id"];

export const storyTheme = z.enum(
  STORY_THEMES.map((theme) => theme.id) as [StoryTheme, ...StoryTheme[]],
);

export function toStoryTheme(value: string): StoryTheme {
  const parsed = storyTheme.safeParse(value);
  return parsed.success ? parsed.data : "classic";
}
