import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { Client } from "pg";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { slugify } from "../lib/slug";
import { blindIndex } from "../lib/field-encryption";
import { newsroomEnvironment, dailySlots, PROFILES, seedDate } from "./newsroom/config";
import { buildStory, cachedResearch, draftSchema, type Research } from "./newsroom/content";
import { generate, researchTopic } from "./newsroom/openai";
import { r2Config } from "../lib/r2";
import { newsroomImages, writeNewsroomImages } from "./newsroom/media";
import { storyNode, documentText } from "../lib/story-document";

const { values } = parseArgs({ options: {
  date: { type: "string", default: new Date().toISOString().slice(0, 10) },
  "max-articles": { type: "string", default: "250" },
  concurrency: { type: "string", default: "4" },
  "profiles-only": { type: "boolean", default: false },
  scheduled: { type: "boolean", default: false },
} });

async function main() {
  const { hosted } = newsroomEnvironment(process.env);
  const storage = hosted ? r2Config() : null;
  if (hosted && !values["profiles-only"] && !storage) throw new Error("Configure R2 storage before running production article generation");
  const date = seedDate(values.date);
  const limit = Number(values["max-articles"]);
  const concurrency = Number(values.concurrency);
  if (!Number.isInteger(limit) || limit < 1 || limit > 250 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    throw new Error("Use --max-articles=1..250 and --concurrency=1..16");
  }
  if (!values["profiles-only"] && !process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for researched articles");
  const lock = new Client({ connectionString: process.env.DATABASE_URL });
  await lock.connect();
  let runStarted = false;
  try {
    const result = await lock.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(733129004) AS locked");
    if (!result.rows[0].locked) throw new Error("Another newsroom seed is already running");
    const cache = path.join(process.cwd(), ".cache/newsroom", date);
    if (!hosted) await mkdir(cache, { recursive: true });
    if (!values["profiles-only"]) {
      const previous = await prisma.newsroomRun.findUnique({ where: { date } });
      if (values.scheduled && previous?.scheduledAt) {
        console.log(`${date}: scheduled attempt already recorded; use the seed command without --scheduled to resume.`);
        return;
      }
      const run = { status: "RUNNING" as const, startedAt: new Date(), completedAt: null, lastError: null, ...(values.scheduled ? { scheduledAt: new Date() } : {}) };
      await prisma.newsroomRun.upsert({ where: { date }, create: { date, ...run }, update: run });
      runStarted = true;
    }

    for (const profile of PROFILES) {
      const existing = await prisma.user.findFirst({ where: { OR: [{ id: profile.id }, { username: profile.username }, { emailHash: blindIndex(profile.email) }] } });
      if (existing && (existing.id !== profile.id || !existing.isSynthetic)) throw new Error(`Profile collision for ${profile.username}; no existing account was modified`);
      await prisma.user.upsert({ where: { id: profile.id }, update: {}, create: {
        id: profile.id, email: profile.email, name: profile.name, username: profile.username,
        bio: `AI-managed fictional ${profile.author ? "writer" : "reader"} based in ${profile.country}. Interested in ${profile.topic}. Posts are AI-generated; engagement is simulated.`,
        isSynthetic: true, activityEmails: false,
      } });
    }
    await prisma.follow.createMany({ data: PROFILES.flatMap((profile, index) => [1, 7, 19, 43].map((offset) => ({ followerId: profile.id, followingId: PROFILES[(index + offset) % 100].id })).filter((follow) => follow.followerId !== follow.followingId)), skipDuplicates: true });
    console.log("Ready: 200 synthetic profiles, 100 authors, follow graph; email and interactive login disabled.");
    if (values["profiles-only"]) return;

    const existingArticles = await prisma.article.findMany({ where: { id: { in: dailySlots(date).map((slot) => slot.id) } }, select: { id: true, authorId: true, content: true } });
    if (storage) {
      for (const article of existingArticles) {
        const slot = dailySlots(date).find((candidate) => candidate.id === article.id && candidate.profile.id === article.authorId);
        if (!slot) continue;
        const doc = storyNode.parse(article.content);
        const index = doc.content?.findIndex((node) => node.type === "image" && node.attrs?.src === `${storage.publicUrl}/stories/${article.authorId}/${article.id}-diagram.webp`) ?? -1;
        if (index < 1) continue;
        const image = doc.content![index];
        const title = documentText(doc.content![index - 1]);
        const stages = (image.attrs?.alt ?? "").slice(title.length + 2).split(" → ");
        if (stages.length !== 5) throw new Error(`Cannot repair diagram metadata for ${article.id}`);
        await writeNewsroomImages(article.authorId, article.id, { diagram: { title, stages } }, slot.topic, PROFILES.findIndex((profile) => profile.id === article.authorId), storage);
        image.attrs = { ...image.attrs, src: newsroomImages(article.authorId, article.id, storage).diagram };
        await prisma.article.update({ where: { id: article.id }, data: { content: doc as Prisma.InputJsonValue, coverImage: newsroomImages(article.authorId, article.id, storage).cover } });
        console.log(`Repaired versioned media for ${article.id}; engagement preserved.`);
      }
    }
    const existing = new Set(existingArticles.map((article) => article.id));
    const slots = dailySlots(date).filter((slot) => !existing.has(slot.id)).slice(0, limit);
    const tags = new Map<string, { id: string }>();
    for (const topic of new Set(slots.map((slot) => slot.topic))) {
      const slug = slugify(topic);
      const tag = await prisma.tag.findFirst({ where: { OR: [{ slug }, { name: topic }] }, select: { id: true } }) ??
        await prisma.tag.upsert({ where: { slug }, create: { name: topic, slug }, update: {}, select: { id: true } });
      tags.set(topic, tag);
    }
    console.log(`${date}: ${existing.size}/250 articles already complete; generating ${slots.length}, concurrency ${concurrency}.`);
    const research = new Map<string, Promise<Research>>();
    const loadResearch = (topic: string) => {
      let pending = research.get(topic);
      if (!pending) {
        pending = (async () => {
          const filename = path.join(cache, `${slugify(topic)}.json`);
          const saved = await prisma.newsroomResearch.findUnique({ where: { date_topic: { date, topic } } });
          if (saved) return cachedResearch.parse(saved.data);
          let result: Research | undefined;
          if (!hosted) {
            try {
              result = cachedResearch.parse(JSON.parse(await readFile(filename, "utf8")));
            } catch (cause) {
              if (!(cause instanceof Error && "code" in cause && cause.code === "ENOENT")) throw cause;
            }
          }
          if (!result) {
            console.log(`Researching ${topic} with live web search…`);
            result = await researchTopic(topic, date);
          }
          await prisma.newsroomResearch.upsert({ where: { date_topic: { date, topic } }, create: { date, topic, data: result as Prisma.InputJsonValue }, update: {} });
          if (!hosted) await writeFile(filename, JSON.stringify(result), { mode: 0o600 });
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
          const evidence = await loadResearch(slot.topic);
          const topicSlots = dailySlots(date).filter((candidate) => candidate.topic === slot.topic);
          const pitch = evidence.pitches[topicSlots.findIndex((candidate) => candidate.id === slot.id)];
          const images = newsroomImages(slot.profile.id, slot.id, storage);
          const image = images.diagram;
          const { value: draft } = await generate(draftSchema,
            `Write an ORIGINAL 2800–3500 word educational article for a fictional writer from ${slot.profile.country}, focusing on ${slot.topic}. Date: ${date}. Specific pitch: ${JSON.stringify(pitch)}. Distinguish evidence from interpretation, explain trade-offs and uncertainty, give concrete examples and actionable steps. Use 8–10 sections, EACH with EXACTLY THREE substantial paragraphs of 110–150 words (at least 700 characters each), plus practical bullets. Do not condense to an outline or pad by repeating sentences. Include a topic-specific five-stage high-level architecture/process diagram (for engineering use real components and data flow; for lifestyle use an honest conceptual flow). Diagram stage labels must be COMPLETE concise phrases of 2–6 words, without numbers or trailing punctuation. No political content. No invented numbers, URLs or quotes. Use only the evidence below; numeric sourceIds refer to this source list. Cite at least two different sources. Health and finance: general education only, no treatment or investment advice. Provide six varied, clearly simulated reader reviews about SPECIFIC points from this article, with star ratings and both LIKE and DISLIKE reactions. Include at least one critical review. Title must differ from other pitches.\nResearch: ${evidence.summary}\nSources: ${JSON.stringify(evidence.sources.map((source, index) => ({ id: index + 1, ...source })))}`, false, (draft) => { buildStory(draft, evidence, image, date); });
          if (!hosted) await writeFile(path.join(cache, `${slot.id}.json`), JSON.stringify(draft), { mode: 0o600 });
          const story = buildStory(draft, evidence, image, date);
          const tag = tags.get(slot.topic)!;
          const authorIndex = PROFILES.findIndex((profile) => profile.id === slot.profile.id);
          await writeNewsroomImages(slot.profile.id, slot.id, draft, slot.topic, authorIndex, storage);
          const readers = [
            PROFILES[(authorIndex + 1) % 100], PROFILES[(authorIndex + 7) % 100],
            ...[0, 19, 43, 71].map((offset) => PROFILES[100 + (authorIndex + offset) % 100]),
          ];
          await prisma.$transaction(async (tx) => {
            await tx.article.create({ data: {
              id: slot.id, authorId: slot.profile.id, slug: `${slugify(draft.title)}-${date}-${slot.slot + 1}`,
              title: draft.title, subtitle: `AI-generated · ${draft.subtitle}`,
              coverImage: images.cover, content: story.content as Prisma.InputJsonValue, contentText: story.contentText, readTime: story.readTime,
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
    const count = existing.size + completed;
    const articleIds = dailySlots(date).map((slot) => slot.id);
    const [reviews, ratings] = await Promise.all([
      prisma.comment.count({ where: { articleId: { in: articleIds }, body: { startsWith: "[Simulated review" } } }),
      prisma.articleFeedback.count({ where: { articleId: { in: articleIds }, userId: { in: PROFILES.map((profile) => profile.id) }, rating: { not: null } } }),
    ]);
    await prisma.newsroomRun.update({ where: { date }, data: { status: count === 250 ? "COMPLETED" : "PARTIAL", articleCount: count, completedAt: count === 250 ? new Date() : null } });
    console.log(`Engagement audit: ${count} articles, ${reviews} simulated reviews, ${ratings} managed-profile ratings.`);
    console.log(`Complete: ${existing.size + completed}/250 articles for ${date}. Rerunning this date fills remaining slots only.`);
  } catch (cause) {
    if (runStarted) {
      const articleCount = await prisma.article.count({ where: { id: { in: dailySlots(date).map((slot) => slot.id) } } });
      await prisma.newsroomRun.update({ where: { date }, data: { status: "FAILED", articleCount, lastError: "Newsroom run failed; inspect worker logs and resume manually." } });
    }
    throw cause;
  } finally {
    await lock.end();
  }
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : "Newsroom seed failed");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
