export const AI_ACTIONS = {
  polish:
    "Improve grammar, clarity and flow while preserving the author's voice and meaning.",
  shorten:
    "Make this passage concise without losing its key points or changing its meaning.",
  expand:
    "Develop this passage with clearer explanations. Do not invent facts, quotes or citations.",
  outline:
    "Suggest a structured story outline with an opening, key sections and conclusion.",
  titles: "Suggest five specific, compelling story titles. Avoid clickbait.",
  feedback:
    "Give actionable editorial feedback on structure, clarity, pacing and claims needing evidence.",
} as const;

export function responseText(value: unknown): string {
  if (
    !value ||
    typeof value !== "object" ||
    !("output" in value) ||
    !Array.isArray(value.output)
  )
    return "";
  return value.output
    .flatMap((item: unknown) => {
      if (
        !item ||
        typeof item !== "object" ||
        !("type" in item) ||
        item.type !== "message" ||
        !("content" in item) ||
        !Array.isArray(item.content)
      )
        return [];
      return item.content.flatMap((part: unknown) =>
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "output_text" &&
        "text" in part &&
        typeof part.text === "string"
          ? [part.text]
          : [],
      );
    })
    .join("\n");
}
