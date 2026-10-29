import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { Client } from "pg";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { slugify } from "../lib/slug";
import { blindIndex } from "../lib/field-encryption";
import { assertLocalEnvironment, dailySlots, PROFILES, seedDate } from "./newsroom/config";
import { buildStory, cachedResearch, coverSvg, diagramSvg, draftSchema, type Research } from "./newsroom/content";
import { generate, researchTopic } from "./newsroom/openai";

const { values } = parseArgs({ options: {
  date: { type: "string", default: new Date().toISOString().slice(0, 10) },
  "max-articles": { type: "string", default: "250" },
  concurrency: { type: "string", default: "4" },
  "profiles-only": { type: "boolean", default: false },
} });

async function main() {
  assertLocalEnvironment(process.env);
  const date = seedDate(values.date);
  const limit = Number(values["max-articles"]);
  const concurrency = Number(values.concurrency);
  if (!Number.isInteger(limit) || limit < 1 || limit > 250 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    throw new Error("Use --max-articles=1..250 and --concurrency=1..16");
  }
  if (!values["profiles-only"] && !process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for researched articles");
  const lock = new Client({ connectionString: process.env.DATABASE_URL });
  await lock.connect();
  try {
    const result = await lock.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(733129004) AS locked");
    if (!result.rows[0].locked) throw new Error("Another newsroom seed is already running");
    const directory = path.join(process.cwd(), "public/demo/newsroom");
    const cache = path.join(process.cwd(), ".cache/newsroom", date);
    await mkdir(directory, { recursive: true });
    await mkdir(cache, { recursive: true });

    for (const profile of PROFILES) {
      const existing = await prisma.user.findFirst({ where: { OR: [{ id: profile.id }, { username: profile.username }, { emailHash: blindIndex(profile.email) }] } });
      if (existing && (existing.id !== profile.id || !existing.isSynthetic)) throw new Error(`Profile collision for ${profile.username}; no existing account was modified`);
      await prisma.user.upsert({ where: { id: profile.id }, update: {}, create: {
        id: profile.id, email: profile.email, name: profile.name, username: profile.username,
        bio: `Fictional AI demo ${profile.author ? "writer" : "reader"} based in ${profile.country}. Interested in ${profile.topic}. All activity is simulated.`,
        isSynthetic: true, activityEmails: false,
      } });
    }
    await prisma.follow.createMany({ data: PROFILES.flatMap((profile, index) => [1, 7, 19, 43].map((offset) => ({ followerId: profile.id, followingId: PROFILES[(index + offset) % 100].id })).filter((follow) => follow.followerId !== follow.followingId)), skipDuplicates: true });
    console.log("Ready: 200 synthetic profiles, 100 authors, follow graph; email and interactive login disabled.");
    if (values["profiles-only"]) return;

    const existing = new Set((await prisma.article.findMany({ where: { id: { in: dailySlots(date).map((slot) => slot.id) } }, select: { id: true } })).map((article) => article.id));
    const slots = dailySlots(date).filter((slot) => !existing.has(slot.id)).slice(0, limit);
    console.log(`${date}: ${existing.size}/250 articles already complete; generating ${slots.length}, concurrency ${concurrency}.`);
    const research = new Map<string, Promise<Research>>();
    const loadResearch = (topic: string) => {
      let pending = research.get(topic);
      if (!pending) {
        pending = (async () => {
          const filename = path.join(cache, `${slugify(topic)}.json`);
          try {
            return cachedResearch.parse(JSON.parse(await readFile(filename, "utf8")));
          } catch (cause) {
            if (!(cause instanceof Error && "code" in cause && cause.code === "ENOENT")) throw cause;
          }
          console.log(`Researching ${topic} with live web search…`);
          const result = await researchTopic(topic, date);
          await writeFile(filename, JSON.stringify(result), { mode: 0o600 });
          return result;
        })();
        research.set(topic, pending);
      }
      return pending;
    };
    let cursor = 0;
    let completed = 0;
    let failed = false;
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (!failed) {
        const slot = slots[cursor++];
        if (!slot) return;
        try {
          const evidence = await loadResearch(slot.profile.topic);
          const topicSlots = dailySlots(date).filter((candidate) => candidate.profile.topic === slot.profile.topic);
          const pitch = evidence.pitches[topicSlots.findIndex((candidate) => candidate.id === slot.id)];
          const image = `/demo/newsroom/${slot.id}.webp`;
          const { value: draft } = await generate(draftSchema,
            `Write an ORIGINAL 2800–3500 word educational article for a fictional writer from ${slot.profile.country}, focusing on ${slot.profile.topic}. Date: ${date}. Specific pitch: ${JSON.stringify(pitch)}. Distinguish evidence from interpretation, explain trade-offs and uncertainty, give concrete examples and actionable steps. Use 8–10 sections, EACH with EXACTLY THREE substantial paragraphs of 110–150 words (at least 700 characters each), plus practical bullets. Do not condense to an outline or pad by repeating sentences. Include a topic-specific five-stage high-level architecture/process diagram (for engineering use real components and data flow; for lifestyle use an honest conceptual flow). Diagram stage labels must be COMPLETE concise phrases of 2–6 words, without numbers or trailing punctuation. No political content. No invented numbers, URLs or quotes. Use only the evidence below; numeric sourceIds refer to this source list. Cite at least two different sources. Health and finance: general education only, no treatment or investment advice. Provide six varied, clearly simulated reader reviews about SPECIFIC points from this article, with star ratings and both LIKE and DISLIKE reactions. Include at least one critical review. Title must differ from other pitches.\nResearch: ${evidence.summary}\nSources: ${JSON.stringify(evidence.sources.map((source, index) => ({ id: index + 1, ...source })))}`, false, (draft) => { buildStory(draft, evidence, image, date); });
          await writeFile(path.join(cache, `${slot.id}.json`), JSON.stringify(draft), { mode: 0o600 });
          const story = buildStory(draft, evidence, image, date);
          await sharp(Buffer.from(diagramSvg(draft, slot.profile.topic))).webp().toFile(path.join(directory, `${slot.id}.webp`));
          const tag = await prisma.tag.upsert({ where: { slug: slugify(slot.profile.topic) }, update: {}, create: { name: slot.profile.topic, slug: slugify(slot.profile.topic) } });
          const authorIndex = PROFILES.findIndex((profile) => profile.id === slot.profile.id);
          const cover = `/demo/newsroom/${slot.id}-cover.webp`;
          await sharp(Buffer.from(coverSvg(authorIndex))).webp().toFile(path.join(directory, `${slot.id}-cover.webp`));
          const readers = [
            PROFILES[(authorIndex + 1) % 100], PROFILES[(authorIndex + 7) % 100],
            ...[0, 19, 43, 71].map((offset) => PROFILES[100 + (authorIndex + offset) % 100]),
          ];
          await prisma.$transaction(async (tx) => {
            await tx.article.create({ data: {
              id: slot.id, authorId: slot.profile.id, slug: `${slugify(draft.title)}-${date}-${slot.slot + 1}`,
              title: draft.title, subtitle: `AI demo · ${draft.subtitle}`,
              coverImage: cover, content: story.content as Prisma.InputJsonValue, contentText: story.contentText, readTime: story.readTime,
              published: true, publishedAt: new Date(), theme: authorIndex % 2 ? "bold" : "technical",
              tags: { create: { tagId: tag.id } },
            } });
            await tx.articleFeedback.createMany({ data: draft.reviews.map((review, index) => ({ articleId: slot.id, voterId: readers[index].id, userId: readers[index].id, reaction: review.reaction, rating: review.rating })) });
            await tx.comment.createMany({ data: draft.reviews.map((review, index) => ({ id: `${slot.id}-review-${index}`, articleId: slot.id, authorId: readers[index].id, body: `[Simulated review · ${review.rating}/5] ${review.body}` })) });
          });
          completed++;
          console.log(`Published ${completed}/${slots.length}: ${slot.id} · ${story.readTime} min · ${draft.title}`);
        } catch (cause) {
          failed = true;
          console.error(`Failed ${slot.id}; completed articles remain intact. Rerun the same date to resume.`);
          console.error(cause instanceof Error ? cause.message : "Unknown generation failure");
        }
      }
    }));
    if (failed) throw new Error("Seed incomplete; see the failed slot above");
    console.log(`Complete: ${existing.size + completed}/250 articles for ${date}. Rerunning this date fills remaining slots only.`);
  } finally {
    await lock.end();
  }
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : "Newsroom seed failed");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
