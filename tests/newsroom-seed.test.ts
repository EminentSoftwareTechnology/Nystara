import assert from "node:assert/strict";
import { test } from "node:test";
import { assertLocalEnvironment, dailySlots, londonRunDate, PROFILES, seedDate } from "../prisma/newsroom/config";
import { buildStory, diagramSvg, type Draft, type Research } from "../prisma/newsroom/content";
import { researchSources } from "../prisma/newsroom/openai";
import { isOwnedProfileImage, isStorageImage } from "../lib/storage-url";

test("200 distinct global profiles include 100 authors with 2–3 stable daily slots", () => {
  assert.equal(PROFILES.length, 200);
  for (const key of ["name", "email", "username", "id"] as const) assert.equal(new Set(PROFILES.map((profile) => profile[key])).size, 200);
  assert.equal(new Set(PROFILES.map((profile) => profile.country)).size, 20);
  assert.equal(PROFILES.filter((profile) => profile.author).length, 100);
  assert.ok(PROFILES.every((profile) => /^[a-z]+\.nystara@gmail\.com$/.test(profile.email)));
  const slots = dailySlots("2026-10-28");
  assert.equal(slots.length, 250);
  assert.equal(new Set(slots.map((slot) => slot.id)).size, 250);
  for (const author of PROFILES.filter((profile) => profile.author)) assert.ok([2, 3].includes(slots.filter((slot) => slot.profile.id === author.id).length));
  assert.deepEqual(slots, dailySlots("2026-10-28"));
  assert.ok(!dailySlots("2026-10-27").some((slot) => slots.some((other) => slot.id === other.id)));
});

test("the seed refuses production, remote databases and invalid/future dates", () => {
  for (const DATABASE_URL of ["postgresql://localhost/db", "postgresql://127.0.0.1/db", "postgresql://[::1]/db"]) assert.doesNotThrow(() => assertLocalEnvironment({ DATABASE_URL }));
  assert.throws(() => assertLocalEnvironment({ DATABASE_URL: "postgresql://example.test/db" }));
  assert.throws(() => assertLocalEnvironment({ NODE_ENV: "production", DATABASE_URL: "postgresql://localhost/db" }));
  for (const date of ["2026-02-30", "../x", "2099-01-01"]) assert.throws(() => seedDate(date));
});

test("daily scheduling follows London daylight saving rather than the machine timezone", () => {
  assert.equal(londonRunDate(new Date("2026-10-29T07:00:00Z")), "2026-10-29");
  assert.equal(londonRunDate(new Date("2026-07-15T06:00:00Z")), "2026-07-15");
  assert.equal(londonRunDate(new Date("2026-07-15T07:00:00Z")), null);
  assert.equal(londonRunDate(new Date("2026-10-29T06:00:00Z")), null);
});

test("research retains only actual HTTPS tool sources, deduplicates them and rejects credential URLs", () => {
  const sources = researchSources([{ type: "web_search_call", action: { sources: [
    { url: "https://example.test/research", title: "Research" },
    { url: "https://example.test/research", title: "Research" },
    { url: "javascript:alert(1)" }, { url: "https://secret@example.test/path" },
  ] } }]);
  assert.deepEqual(sources, [{ url: "https://example.test/research", title: "Research" }]);
});

const draft: Draft = {
  title: "A sourced demonstration", subtitle: "Evidence and limits", nonPolitical: true,
  sections: Array.from({ length: 8 }, (_, index) => ({ heading: `Section ${index}`, paragraphs: [Array.from({ length: 140 }, (_, word) => `observation${word}`).join(" "), Array.from({ length: 140 }, (_, word) => `example${word}`).join(" ")], bullets: ["Test the assumption", "Record the result"] })),
  diagram: { title: "High-level design", stages: ["Input", "Validate", "Process", "Store", "Review"] },
  sourceIds: [1, 2], reviews: Array.from({ length: 6 }, (_, index) => ({ body: "The explanation of validation and its limitations helped clarify the process.", rating: index ? 4 : 2, reaction: index ? "LIKE" : "DISLIKE" })),
};
const research: Research = { summary: "Evidence", pitches: [], researchedAt: "2026-10-28", sources: [{ url: "https://example.test/a", title: "Source A" }, { url: "https://example.test/b", title: "Source B" }], video: { url: "https://www.youtube.com/watch?v=M7lc1UVf-VE", title: "Example", thumbnail: "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg" } };

test("long stories contain disclosure, diagrams, semantic lists, video and linked sources", () => {
  const story = buildStory(draft, research, "/demo/newsroom/test.webp", "2026-10-28");
  assert.ok(story.readTime >= 10);
  assert.match(story.contentText, /fictional local test data/);
  for (const type of ["image", "video", "bulletList", "heading"]) assert.ok(story.content.content?.some((node) => node.type === type));
  assert.match(JSON.stringify(story.content), /https:\/\/example.test\/a/);
  assert.throws(() => buildStory({ ...draft, sections: [] }, research, "/demo/newsroom/test.webp", "2026-10-28"), /2000/);
  assert.throws(() => buildStory({ ...draft, sourceIds: [1, 99] }, research, "/demo/newsroom/test.webp", "2026-10-28"), /unknown research/);
  assert.throws(() => buildStory({ ...draft, sourceIds: [1, 1] }, research, "/demo/newsroom/test.webp", "2026-10-28"), /distinct research/);
  assert.throws(() => buildStory({ ...draft, title: "Presidential campaign" }, research, "/demo/newsroom/test.webp", "2026-10-28"), /Political/);
  assert.throws(() => buildStory({ ...draft, reviews: draft.reviews.map((review) => ({ ...review, reaction: "LIKE" })) }, research, "/demo/newsroom/test.webp", "2026-10-28"), /critical/);
});

test("generated diagrams escape XML and local images use a narrowly bounded path", () => {
  const svg = diagramSvg({ ...draft, diagram: { ...draft.diagram, title: '<script>alert("x")</script>' } }, "AI & Robotics");
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /AI &amp; ROBOTICS/);
  assert.equal(isStorageImage("/demo/newsroom/test.webp"), true);
  assert.equal(isOwnedProfileImage("/demo/newsroom/test.webp", "owner"), false);
  for (const image of ["/demo/newsroom/../secret.webp", "/demo/newsroom/test.svg", "/demo/newsroom/test.webp?x=1", "//evil.test/demo/newsroom/a.webp"]) assert.equal(isStorageImage(image), false);
});
