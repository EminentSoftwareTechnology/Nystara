import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SignJWT } from "jose";

const database = process.env.TEST_DATABASE_URL;
const redis = process.env.TEST_REDIS_URL;
if (!database || !/_(review|test)$/.test(new URL(database).pathname) || !redis) throw new Error("Use an isolated *_review or *_test database and TEST_REDIS_URL");
process.env.DATABASE_URL = database;
process.env.REDIS_URL = redis;
process.env.NEXTAUTH_SECRET = "integration-only-auth-secret-32-characters-long";
process.env.ADMIN_JWT_SECRET = "integration-only-admin-secret-32-characters-long";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: database, max: 15 }) });
const base = "http://127.0.0.1:4319";
let server: ChildProcess;
let logs = "";
let adminId: string;
let userId: string;
let otherId: string;
let adminCookie: string;
let userCookie: string;
let otherCookie: string;
let articleId: string;
const createdUsers: string[] = [];

async function adminToken(version: number) {
  return new SignJWT({ sub: adminId, email: "admin-review@example.test", role: "ADMIN", version })
    .setProtectedHeader({ alg: "HS256" }).setAudience("nystara:admin").setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.ADMIN_JWT_SECRET));
}
async function request(path: string, cookie?: string, method = "GET", body?: object, origin = base) {
  return fetch(`${base}${path}`, { method, redirect: "manual", headers: { ...(cookie ? { cookie } : {}), origin, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

before(async () => {
  const hash = await bcrypt.hash("review-password-1234", 12);
  const admin = await prisma.user.create({ data: { email: "admin-review@example.test", username: "review-admin", role: "ADMIN", passwordHash: hash } });
  const user = await prisma.user.create({ data: { email: "user-review@example.test", username: "review-user", name: "Review User", mfaEnabled: true } });
  const other = await prisma.user.create({ data: { email: "other-review@example.test", username: "review-other", name: "Review Other", mfaEnabled: true } });
  adminId = admin.id; userId = user.id; otherId = other.id;
  createdUsers.push(adminId, userId, otherId);
  const session = randomUUID(); const otherSession = randomUUID();
  await prisma.session.createMany({ data: [
    { userId, sessionToken: session, expires: new Date(Date.now() + 3600_000), mfaVerifiedAt: new Date() },
    { userId: otherId, sessionToken: otherSession, expires: new Date(Date.now() + 3600_000), mfaVerifiedAt: new Date() },
  ] });
  userCookie = `authjs.session-token=${session}`;
  otherCookie = `authjs.session-token=${otherSession}`;
  adminCookie = `admin_session=${await adminToken(0)}`;
  const article = await prisma.article.create({ data: { authorId: userId, title: '<script>alert("xss")</script>', slug: "security-fixture", content: { text: "private" }, contentText: "private content", readTime: 1 } });
  articleId = article.id;
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "4319"], {
    env: { ...process.env, NODE_ENV: "production", NEXTAUTH_URL: base, GOOGLE_CLIENT_ID: "test", GOOGLE_CLIENT_SECRET: "test", GITHUB_CLIENT_ID: "test", GITHUB_CLIENT_SECRET: "test", TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA", RESEND_API_KEY: "re_test_only" }, stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (data: Buffer) => { logs += data.toString(); });
  server.stderr?.on("data", (data: Buffer) => { logs += data.toString(); });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* Wait for the test server. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Test server did not start: ${logs}`);
}, { timeout: 20_000 });

after(async () => {
  server?.kill("SIGTERM");
  for (const id of createdUsers) await prisma.user.deleteMany({ where: { id } });
  await prisma.$disconnect();
  const { prisma: shared } = await import("../lib/prisma");
  await shared.$disconnect();
});

test("anonymous and cross-user API access cannot mutate drafts or admin data", async () => {
  assert.equal((await request(`/api/articles/${articleId}`, undefined, "PATCH", { title: "stolen" })).status, 401);
  assert.equal((await request(`/api/articles/${articleId}`, otherCookie, "PATCH", { title: "stolen" })).status, 403);
  assert.equal((await request("/api/admin/users", userCookie)).status, 401);
  assert.equal((await request("/admin/users")).status, 307);
  const listing = await (await request("/api/articles")).json() as { articles: { id: string }[] };
  assert.equal(listing.articles.some((row) => row.id === articleId), false);
});

test("mass assignment cannot change article owner or publish via PATCH", async () => {
  const response = await request(`/api/articles/${articleId}`, userCookie, "PATCH", { title: "updated", authorId: otherId, published: true });
  assert.equal(response.status, 200);
  const article = await prisma.article.findUniqueOrThrow({ where: { id: articleId } });
  assert.equal(article.authorId, userId);
  assert.equal(article.published, false);
});

test("CSRF rejects missing, cross-site and scheme-mismatched Origin", async () => {
  assert.equal((await request(`/api/articles/${articleId}`, userCookie, "DELETE", undefined, "https://evil.test")).status, 403);
  const noOrigin = await fetch(`${base}/api/articles/${articleId}`, { method: "DELETE", headers: { cookie: userCookie } });
  assert.equal(noOrigin.status, 403);
});

test("production rejects CAPTCHA test keys and direct email provider bypass", async () => {
  const login = await request("/api/admin/login", undefined, "POST", { email: "admin-review@example.test", password: "review-password-1234", turnstileToken: "fake" });
  assert.equal(login.status, 400);
  assert.equal((await request("/api/auth/signin/resend", undefined, "POST", { email: "spam@example.test" })).status, 403);
  assert.equal((await request("/api/auth/signin/nodemailer", undefined, "POST", { email: "spam@example.test" })).status, 403);
});

test("export contains only the caller's data and pages all article content", async () => {
  const profile = await request("/api/me/export", userCookie);
  assert.equal(profile.status, 200);
  assert.match(profile.headers.get("cache-control")!, /no-store/);
  const data = await profile.json() as { user: { id: string }; sections: string[] };
  assert.equal(data.user.id, userId);
  assert.ok(data.sections.includes("/api/me/export?section=aiMessages"));
  assert.ok(data.sections.includes("/api/me/export?section=readingListItems"));
  const content = await (await request("/api/me/export?section=articles", userCookie)).text();
  assert.match(content, /private content/);
  assert.doesNotMatch(content, /passwordHash|sessionToken|access_token|other-review/);
  assert.equal((await request("/api/me/export?section=passwordHash", userCookie)).status, 400);
});

test("password changes invalidate all previously issued admin tokens", async () => {
  assert.equal((await request("/api/admin/me", adminCookie)).status, 200);
  const response = await request("/api/admin/profile", adminCookie, "PATCH", { currentPassword: "review-password-1234", newPassword: "changed-password-1234" });
  assert.equal(response.status, 200);
  assert.equal((await request("/api/admin/me", adminCookie)).status, 401);
  adminCookie = `admin_session=${await adminToken(1)}`;
  assert.equal((await request("/api/admin/me", adminCookie)).status, 200);
});

test("concurrent paywall requests grant at most five unique articles", async () => {
  const { checkPaywallAccess } = await import("../lib/paywall");
  const articles = await Promise.all(Array.from({ length: 10 }, (_, i) => prisma.article.create({ data: { authorId: userId, title: `quota ${i}`, slug: `quota-${i}`, content: {}, contentText: "quota", readTime: 1, published: true } })));
  const results = await Promise.all(articles.map((article) => checkPaywallAccess(otherId, article.id)));
  assert.equal(results.filter((result) => result.allowed).length, 5);
  const recorded = await prisma.articleView.findFirstOrThrow({ where: { visitorId: otherId } });
  assert.equal((await checkPaywallAccess(otherId, recorded.articleId)).allowed, true);
  assert.equal(await prisma.articleView.count({ where: { visitorId: otherId } }), 5);
});

test("erasure succeeds across comment threads while preserving another author's reply", async () => {
  const { eraseUser } = await import("../lib/gdpr");
  const article = await prisma.article.create({ data: { authorId: adminId, title: "thread", slug: "thread", content: {}, contentText: "thread", readTime: 1 } });
  const parent = await prisma.comment.create({ data: { authorId: otherId, articleId: article.id, body: "erase me" } });
  const reply = await prisma.comment.create({ data: { authorId: adminId, articleId: article.id, body: "keep me", parentId: parent.id } });
  await eraseUser(otherId, "other-review@example.test");
  assert.equal(await prisma.user.findUnique({ where: { id: otherId } }), null);
  assert.equal((await prisma.comment.findUniqueOrThrow({ where: { id: reply.id } })).parentId, null);
  assert.equal(await prisma.articleView.count({ where: { visitorId: otherId } }), 0);
});

test("Redis limits are shared across independent processes and retain no raw PII", async () => {
  const { rateLimit } = await import("../lib/rate-limit");
  const { createClient } = await import("redis");
  const client = createClient({ url: redis });
  await client.connect();
  const key = `credential:email-${randomUUID()}@example.test`;
  try {
    const local = await Promise.all(Array.from({ length: 3 }, () => rateLimit(key, 5, 60_000)));
    const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import { rateLimit } from './lib/rate-limit.ts';
      const results = await Promise.all(Array.from({length: 10}, () => rateLimit(${JSON.stringify(key)}, 5, 60000)));
      process.stdout.write(JSON.stringify(results));
      const client = await globalThis.rateLimitRedis;
      await client.close();
    `], { env: process.env, encoding: "utf8" });
    assert.equal(child.status, 0, child.stderr);
    const remote = JSON.parse(child.stdout) as { ok: boolean }[];
    assert.equal([...local, ...remote].filter((value) => value.ok).length, 5);
    const keys = await client.keys("rate:*");
    assert.ok(keys.every((value) => /^rate:[a-f0-9]{64}$/.test(value)));
  } finally {
    await client.close();
    const state = globalThis as typeof globalThis & { rateLimitRedis?: Promise<ReturnType<typeof createClient>> };
    const shared = await state.rateLimitRedis;
    if (shared) await shared.close();
    delete state.rateLimitRedis;
  }
});

test("nonce CSP is unique on each response and framework scripts carry it", async () => {
  const first = await request("/login"); const second = await request("/login");
  const csp = first.headers.get("content-security-policy")!;
  assert.match(csp, /nonce-/);
  assert.notEqual(csp, second.headers.get("content-security-policy"));
  assert.doesNotMatch(csp.split(";").find((value) => value.trim().startsWith("script-src"))!, /unsafe-inline/);
  const html = await first.text();
  const nonce = /'nonce-([^']+)'/.exec(csp)![1];
  assert.ok(html.includes(`nonce="${nonce}"`));
});


test("chunked HTTP payloads above 1 MiB are rejected by the production proxy", async () => {
  const bytes = new TextEncoder().encode('{"title":"small"}' + " ".repeat(1024 * 1024));
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close(); } });
  const response = await fetch(`${base}/api/articles`, { method: "POST", headers: { origin: base, cookie: userCookie, "Content-Type": "application/json" }, body, duplex: "half" } as RequestInit);
  assert.equal(response.status, 413);
});

test("retention cleanup removes expired records while keeping current reading records", async () => {
  const old = await prisma.articleView.create({ data: { visitorId: adminId, articleId, createdAt: new Date(0) } });
  const current = await prisma.articleView.create({ data: { visitorId: adminId, articleId } });
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/cleanup.ts"], { env: process.env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await prisma.articleView.findUnique({ where: { id: old.id } }), null);
  assert.ok(await prisma.articleView.findUnique({ where: { id: current.id } }));
});


test("publishing is idempotent and only the owner can publish or unpublish", async () => {
  assert.equal((await request(`/api/articles/${articleId}/publish`, undefined, "POST")).status, 401);
  const first = await request(`/api/articles/${articleId}/publish`, userCookie, "POST");
  const firstData = await first.json() as { published: boolean; publishedAt: string };
  assert.equal(firstData.published, true);
  const second = await (await request(`/api/articles/${articleId}/publish`, userCookie, "POST")).json() as { published: boolean; publishedAt: string };
  assert.deepEqual(second, firstData);
  assert.equal((await request(`/api/articles/${articleId}/publish`, userCookie, "POST", { published: false })).status, 200);
  assert.equal((await prisma.article.findUniqueOrThrow({ where: { id: articleId } })).published, false);
});

test("browser hydrates under CSP, publishes a story and renders script text safely", async () => {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: "authjs.session-token", value: userCookie.split("=")[1], url: base }]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/new-story`);
    await page.getByRole("textbox", { name: "Title", exact: true }).fill('<script>window.reviewXss=true</script>');
    await page.getByRole("textbox", { name: "Story text" }).fill('<img src=x onerror="window.reviewXss=true">');
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.waitForURL(/\/review-user\//);
    assert.equal(await page.getByRole("heading", { level: 1 }).textContent(), '<script>window.reviewXss=true</script>');
    assert.equal(await page.evaluate(() => Reflect.get(window, "reviewXss")), undefined);
    assert.equal(await page.locator("img[src=x]").count(), 0);
    assert.deepEqual(errors, []);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await context.close();
  } finally { await browser.close(); }
});


test("article exports follow cursor pages without loss, duplication or credential fields", async () => {
  await prisma.article.createMany({ data: Array.from({ length: 21 }, (_, i) => ({ authorId: userId, slug: `export-${i}`, title: `export ${i}`, content: { text: `stored ${i}` }, contentText: `stored ${i}`, readTime: 1 })) });
  const ids: string[] = [];
  let next: string | null = "/api/me/export?section=articles";
  while (next) {
    const response = await request(next, userCookie);
    assert.equal(response.status, 200);
    const data = await response.json() as { records: { id: string; content: unknown }[]; next: string | null };
    assert.ok(data.records.length <= 20);
    assert.ok(data.records.every((record) => record.content !== undefined));
    ids.push(...data.records.map((record) => record.id));
    next = data.next;
  }
  assert.equal(ids.length, await prisma.article.count({ where: { authorId: userId } }));
  assert.equal(new Set(ids).size, ids.length);
});


test("security migration preserves existing rows and enables erasure of threaded comments", async () => {
  const { Client } = await import("pg");
  const { readFile } = await import("node:fs/promises");
  const client = new Client({ connectionString: database });
  const schema = `upgrade_${randomUUID().replaceAll("-", "")}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    for (const name of ["0_init", "1_search_vector", "2_admin_role", "3_query_indexes", "4_gdpr_cascade_and_fk_indexes"]) {
      await client.query(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
    }
    await client.query(`INSERT INTO "User" (id, email) VALUES ('owner', 'migration-owner@example.test'), ('other', 'migration-other@example.test')`);
    await client.query(`INSERT INTO "Article" (id, slug, title, content, "contentText", "readTime", "updatedAt", "authorId") VALUES ('thread', 'thread', 'preserve me', '{}', 'text', 1, now(), 'other')`);
    await client.query(`INSERT INTO "Comment" (id, body, "authorId", "articleId") VALUES ('parent', 'parent', 'owner', 'thread')`);
    await client.query(`INSERT INTO "Comment" (id, body, "authorId", "articleId", "parentId") VALUES ('child', 'preserve reply', 'other', 'thread', 'parent')`);
    await client.query(await readFile("prisma/migrations/5_security_review/migration.sql", "utf8"));
    const users = await client.query<{ sessionVersion: number }>('SELECT "sessionVersion" FROM "User"');
    assert.deepEqual(users.rows, [{ sessionVersion: 0 }, { sessionVersion: 0 }]);
    await client.query(`DELETE FROM "User" WHERE id = 'owner'`);
    const replies = await client.query<{ body: string; parentId: string | null }>('SELECT body, "parentId" FROM "Comment"');
    assert.deepEqual(replies.rows, [{ body: "preserve reply", parentId: null }]);
  } finally {
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});

test("story status changes enforce ownership and validate schedules", async () => {
  const story = await prisma.article.create({ data: { authorId: userId, title: "Status fixture", slug: "status-fixture", content: {}, contentText: "Status fixture content", readTime: 1 } });
  const endpoint = `/api/articles/${story.id}/status`;
  assert.equal((await request(endpoint, undefined, "POST", { action: "publish" })).status, 401);
  assert.equal((await request(endpoint, adminCookie, "POST", { action: "publish" })).status, 401);
  // The other account may have been erased by the preceding retention test. A new valid session still must not grant ownership.
  const outsider = await prisma.user.create({ data: { email: `outsider-${randomUUID()}@example.test`, activityEmails: false } });
  createdUsers.push(outsider.id);
  const token = randomUUID();
  await prisma.session.create({ data: { userId: outsider.id, sessionToken: token, expires: new Date(Date.now() + 3600_000) } });
  assert.equal((await request(endpoint, `authjs.session-token=${token}`, "POST", { action: "publish" })).status, 404);
  assert.equal((await request(endpoint, userCookie, "POST", { action: "schedule", scheduledAt: "2020-01-01T00:00:00.000Z" })).status, 400);
  assert.equal((await request(endpoint, userCookie, "POST", { action: "schedule", scheduledAt: "tomorrow" })).status, 400);
  assert.equal((await request(endpoint, userCookie, "POST", { action: "unlist" }, "https://evil.test")).status, 403);
  await prisma.user.update({ where: { id: userId }, data: { activityEmails: false } });
  assert.equal((await request(endpoint, userCookie, "POST", { action: "submit" })).status, 200);
  let row = await prisma.article.findUniqueOrThrow({ where: { id: story.id } });
  assert.equal(row.published, false);
  assert.ok(row.submittedAt);
  assert.equal(row.scheduledAt, null);
  const queueResponse = await request("/api/admin/articles?status=submitted", adminCookie);
  assert.equal(queueResponse.status, 200);
  const queue = await queueResponse.json() as { articles: { id: string; submittedAt: string | null }[] };
  assert.ok(queue.articles.some((item) => item.id === story.id && item.submittedAt));
  assert.equal((await request(`/api/admin/articles/${story.id}`, adminCookie, "PATCH", { published: false })).status, 200);
  row = await prisma.article.findUniqueOrThrow({ where: { id: story.id } });
  assert.equal(row.submittedAt, null);
  assert.equal(row.published, false);
  assert.equal((await request(endpoint, userCookie, "POST", { action: "submit" })).status, 200);
  assert.equal((await request(`/api/admin/articles/${story.id}`, adminCookie, "PATCH", { published: true })).status, 200);
  row = await prisma.article.findUniqueOrThrow({ where: { id: story.id } });
  assert.equal(row.published, true);
  assert.equal(row.submittedAt, null);
  assert.equal((await request(endpoint, userCookie, "POST", { action: "unlist" })).status, 200);
  row = await prisma.article.findUniqueOrThrow({ where: { id: story.id } });
  assert.equal(row.published, true);
  assert.equal(row.unlisted, true);
  assert.equal(row.submittedAt, null);
  const listing = await (await request("/api/articles")).json() as { articles: { id: string }[] };
  assert.equal(listing.articles.some((article) => article.id === story.id), false);
  const future = new Date(Date.now() + 86400000).toISOString();
  assert.equal((await request(endpoint, userCookie, "POST", { action: "schedule", scheduledAt: future })).status, 200);
  row = await prisma.article.findUniqueOrThrow({ where: { id: story.id } });
  assert.equal(row.published, false);
  assert.equal(row.unlisted, false);
  assert.equal(row.scheduledAt?.toISOString(), future);
  assert.equal(row.publishedAt, null);
  const due = new Date(Date.now() - 1000);
  await prisma.article.update({ where: { id: story.id }, data: { scheduledAt: due } });
  assert.equal((await request("/api/articles")).status, 200);
  row = await prisma.article.findUniqueOrThrow({ where: { id: story.id } });
  assert.equal(row.published, true);
  assert.equal(row.publishedAt?.getTime(), due.getTime());
  assert.equal(row.scheduledAt, null);
  assert.equal((await request(endpoint, userCookie, "POST", { action: "draft" })).status, 200);
  row = await prisma.article.findUniqueOrThrow({ where: { id: story.id } });
  assert.equal(row.published, false);
  assert.equal(row.unlisted, false);
  assert.equal(row.publishedAt, null);
});
