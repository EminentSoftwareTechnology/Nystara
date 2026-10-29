import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { Client } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { dailySlots, PROFILES } from "../prisma/newsroom/config";
import { slugify } from "../lib/slug";

test("the job reuses legacy topic names, preserves engagement and skips repeated scheduled attempts", { timeout: 60000 }, async () => {
  const database = process.env.TEST_DATABASE_URL;
  assert.ok(database && /_(test|review)$/.test(new URL(database).pathname), "Use an isolated test database");
  const root = fileURLToPath(new URL("../", import.meta.url));
  const dbName = `newsroom_${randomUUID().replaceAll("-", "")}_test`;
  const master = new Client({ connectionString: database });
  await master.connect();
  await master.query(`CREATE DATABASE "${dbName}"`);
  const url = new URL(database);
  url.pathname = `/${dbName}`;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
  const directory = await mkdtemp(path.join(tmpdir(), "newsroom-job-"));
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: url.href, NODE_ENV: "development", DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"), OPENAI_API_KEY: "test-only", TSX_TSCONFIG_PATH: path.join(root, "tsconfig.json") };
  try {
    const migration = spawnSync(process.execPath, [path.join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"], { cwd: root, env, encoding: "utf8" });
    assert.equal(migration.status, 0, migration.stderr);
    const date = "2001-01-02";
    const slots = dailySlots(date);
    await prisma.user.createMany({ data: PROFILES.map((profile) => ({ id: profile.id, email: profile.email, username: profile.username, isSynthetic: true, activityEmails: false })) });
    await prisma.article.createMany({ data: slots.slice(1).map((slot) => ({ id: slot.id, authorId: slot.profile.id, slug: slot.id, title: "Existing story", content: {}, contentText: "Existing story", readTime: 1 })) });
    const existing = await prisma.comment.create({ data: { articleId: slots[1].id, authorId: PROFILES[199].id, body: "Preserve this existing review" } });
    await prisma.articleFeedback.create({ data: { articleId: slots[1].id, voterId: PROFILES[199].id, userId: PROFILES[199].id, reaction: "LIKE", rating: 5 } });
    const legacy = await prisma.tag.create({ data: { name: slots[0].topic, slug: `legacy-${slugify(slots[0].topic)}` } });
    await prisma.newsroomRun.create({ data: { date } });
    await prisma.newsroomResearch.create({ data: { date, topic: slots[0].topic, data: {
      summary: "A synthetic research fixture", researchedAt: "2001-01-02T07:00:00Z",
      pitches: Array.from({ length: 30 }, (_, index) => ({ title: `Pitch ${index}`, angle: "A synthetic explanation" })),
      sources: [{ url: "https://example.test/a", title: "A" }, { url: "https://example.test/b", title: "B" }],
      video: { url: "https://www.youtube.com/watch?v=M7lc1UVf-VE", title: "Fixture", thumbnail: "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg" },
    } } });
    const draft = {
      title: "A generated integration story", subtitle: "A synthetic fixture", nonPolitical: true,
      sections: Array.from({ length: 8 }, (_, index) => ({ heading: `Section ${index}`, paragraphs: Array.from({ length: 3 }, () => Array.from({ length: 105 }, (_, word) => `observation${word}`).join(" ")), bullets: ["Check the evidence", "Record the result"] })),
      diagram: { title: "High-level process", stages: ["Collect", "Validate", "Process", "Store", "Review"] },
      sourceIds: [1, 2], reviews: Array.from({ length: 6 }, (_, index) => ({ body: "The validation and evidence section clearly explains the limits of the process.", rating: index ? 4 : 2, reaction: index ? "LIKE" : "DISLIKE" })),
    };
    const preload = path.join(directory, "provider.mjs");
    await writeFile(preload, `globalThis.fetch=async(url)=>{if(url!=="https://api.openai.com/v1/responses")throw new Error("Unexpected external request");return Response.json(${JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(draft) }] }] })});};`);
    const args = ["--import", createRequire(import.meta.url).resolve("tsx"), "--import", preload, path.join(root, "prisma/newsroom-seed.ts"), `--date=${date}`, "--max-articles=1", "--scheduled"];
    const run = spawnSync(process.execPath, args, { cwd: directory, env, encoding: "utf8" });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    const generated = await prisma.article.findUniqueOrThrow({ where: { id: slots[0].id }, include: { tags: true, comments: true, feedback: true } });
    assert.equal(generated.tags[0].tagId, legacy.id);
    assert.equal(generated.comments.length, 6);
    assert.equal(generated.feedback.length, 6);
    assert.equal((await prisma.comment.findUniqueOrThrow({ where: { id: existing.id } })).body, existing.body);
    assert.equal((await prisma.newsroomRun.findUniqueOrThrow({ where: { date } })).status, "COMPLETED");
    const repeated = spawnSync(process.execPath, args, { cwd: directory, env, encoding: "utf8" });
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.match(repeated.stdout, /scheduled attempt already recorded/);
    assert.equal(await prisma.article.count(), 250);
    assert.equal(await prisma.comment.count(), 7);
    assert.equal(await prisma.articleFeedback.count(), 7);
  } finally {
    await prisma.$disconnect();
    await master.query(`DROP DATABASE "${dbName}" WITH (FORCE)`);
    await master.end();
    await rm(directory, { recursive: true, force: true });
  }
});
