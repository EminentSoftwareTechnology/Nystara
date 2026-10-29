import { z } from "zod";
import { documentText, type StoryNode } from "../../lib/story-document";
import { articleContent } from "../../lib/article-schema";
import { videoUrl, safeVideoThumbnail } from "../../lib/video";

const text = z.string().trim().min(1);
export const researchSchema = z.object({
  summary: text.max(14000),
  pitches: z.array(z.object({ title: text.max(180), angle: text.max(800) })).length(30),
});

export const draftSchema = z.object({
  title: text.max(180),
  subtitle: text.max(300),
  nonPolitical: z.literal(true),
  sections: z.array(z.object({
    heading: text.max(120),
    paragraphs: z.array(text.max(2000)).length(3),
    bullets: z.array(text.max(600)).min(2).max(5),
  })).length(8),
  diagram: z.object({ title: text.max(100), stages: z.array(text.max(60)).length(5) }),
  sourceIds: z.array(z.number().int().min(1)).min(2).max(8),
  reviews: z.array(z.object({
    body: text.min(40).max(900),
    rating: z.number().int().min(1).max(5),
    reaction: z.enum(["LIKE", "DISLIKE"]),
  })).length(6),
});

export type Draft = z.infer<typeof draftSchema>;
export type Source = { url: string; title: string };
export type Video = { url: string; title: string; thumbnail: string };
export type Research = z.infer<typeof researchSchema> & { sources: Source[]; video: Video; researchedAt: string };

export const cachedResearch = researchSchema.extend({
  sources: z.array(z.object({ url: z.url({ protocol: /^https$/ }), title: text })).min(2),
  video: z.object({ url: videoUrl, title: text, thumbnail: z.string().refine(safeVideoThumbnail) }),
  researchedAt: z.iso.datetime(),
});

const paragraph = (text: string): StoryNode => ({ type: "paragraph", content: [{ type: "text", text }] });
const heading = (text: string): StoryNode => ({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text }] });

export class DraftValidationError extends Error {}

export function buildStory(draft: Draft, research: Research, image: string, date: string) {
  if (new Set(draft.sourceIds).size < 2) throw new DraftValidationError("Draft must cite at least two distinct research sources");
  if (draft.sourceIds.some((id) => id > research.sources.length)) throw new DraftValidationError("Draft references an unknown research source");
  const prose = draft.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...section.bullets]).join(" ");
  const words = prose.split(/\s+/).length;
  if (words < 2000 || words > 6000) throw new DraftValidationError(`Article must contain 2000–6000 words; received ${words}`);
  if (/\b(election|politician|partisan|political party|geopolitic|presidential campaign)\w*\b/i.test(`${draft.title} ${prose}`)) {
    throw new DraftValidationError("Political content is excluded from this seed");
  }
  if (!draft.reviews.some((review) => review.reaction === "DISLIKE") || !draft.reviews.some((review) => review.reaction === "LIKE")) {
    throw new DraftValidationError("Simulated reviews must include both positive and critical reactions");
  }
  const content: StoryNode = { type: "doc", content: [
    { type: "blockquote", content: [paragraph(`AI-generated article by a fictional AI-managed author. Comments, reviews, ratings and engagement from these profiles are simulated. Research date: ${date}. Health and finance material is educational, not personal advice.`)] },
    ...draft.sections.flatMap((section, index): StoryNode[] => [
      heading(section.heading),
      ...section.paragraphs.map(paragraph),
      { type: "bulletList", content: section.bullets.map((bullet) => ({ type: "listItem", content: [paragraph(bullet)] })) },
      ...(index === 1 ? [heading(draft.diagram.title), { type: "image" as const, attrs: { src: image, alt: `${draft.diagram.title}: ${draft.diagram.stages.join(" → ")}` } }, paragraph(`High-level design / process flow: ${draft.diagram.stages.join(" → ")}.`)] : []),
    ]),
    heading("Watch and explore"),
    { type: "video", attrs: { url: research.video.url, title: research.video.title, thumbnail: research.video.thumbnail } },
    heading("Sources and further reading"),
    ...[...new Set(draft.sourceIds)].map((id): StoryNode => ({ type: "paragraph", content: [{ type: "text", text: `[${id}] ${research.sources[id - 1].title}`, marks: [{ type: "link", attrs: { href: research.sources[id - 1].url } }] }] })),
  ] };
  articleContent.parse(content);
  const contentText = documentText(content);
  return { content, contentText, readTime: Math.ceil(contentText.split(/\s+/).length / 200) };
}

export function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!);
}

export function diagramSvg(draft: Pick<Draft, "diagram">, topic: string) {
  const colors = ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#fb7185"];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><rect width="1200" height="720" rx="24" fill="#0f172a"/><text x="65" y="85" fill="#94a3b8" font-family="sans-serif" font-size="24">NYSTARA · ${escapeXml(topic.toUpperCase())} · DEMO</text><text x="65" y="150" fill="white" font-family="sans-serif" font-size="30">${escapeXml(draft.diagram.title.slice(0, 62))}</text>${draft.diagram.stages.map((stage, index) => {
    const y = 215 + index * 82;
    return `<rect x="100" y="${y}" width="1000" height="62" rx="16" fill="${colors[index]}"/><text x="135" y="${y + 40}" fill="#0f172a" font-family="sans-serif" font-weight="bold" font-size="23">${index + 1}. ${escapeXml(stage.replace(/^\d+[.)]\s*/, ""))}</text>${index < 4 ? `<path d="M600 ${y + 64} v14 m-7 -7 l7 7 7 -7" fill="none" stroke="white" stroke-width="2"/>` : ""}`;
  }).join("")}<text x="65" y="685" fill="#94a3b8" font-family="sans-serif" font-size="20">Illustrative high-level flow · Read the article for limitations and evidence</text></svg>`;
}

export function coverSvg(index: number) {
  const colors = ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#fb7185"];
  const color = colors[index % colors.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0f172a"/><stop offset="1" stop-color="#312e81"/></linearGradient><radialGradient id="glow"><stop stop-color="${color}" stop-opacity=".8"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="1600" height="900" fill="url(#bg)"/><circle cx="1250" cy="350" r="650" fill="url(#glow)"/><g fill="none" stroke="${color}" stroke-width="3" opacity=".6"><circle cx="1250" cy="450" r="170"/><ellipse cx="1250" cy="450" rx="340" ry="100" transform="rotate(45 1250 450)"/><ellipse cx="1250" cy="450" rx="340" ry="100" transform="rotate(-45 1250 450)"/><circle cx="1250" cy="450" r="280" stroke-dasharray="5 18"/></g><g fill="${color}"><circle cx="1250" cy="450" r="24"/><circle cx="1110" cy="310" r="16"/><circle cx="1450" cy="650" r="20"/></g></svg>`;
}
