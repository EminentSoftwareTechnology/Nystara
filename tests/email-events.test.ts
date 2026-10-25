import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";

type Handler = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
type Notice = { userId: string; event: string; options: unknown };

function loadPost(path: string, imports: Record<string, unknown>): Handler {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
  const exports: { POST?: Handler } = {};
  const require = createRequire(import.meta.url);
  runInNewContext(outputText, {
    exports,
    require: (id: string) => id in imports ? imports[id] : require(id),
  });
  assert.ok(exports.POST);
  return exports.POST;
}

function notifications(notices: Notice[]) {
  return { notifyUser: async (userId: string, event: string, options: unknown) => { notices.push({ userId, event, options }); } };
}

for (const [before, after] of [[false, true], [true, false], [true, true], [false, false]]) {
  test(`publication ${before} → ${after} sends only for a state change`, async () => {
    const notices: Notice[] = [];
    const handler = loadPost("app/api/articles/[id]/publish/route.ts", {
      "@/lib/auth": { auth: async () => ({ user: { id: "author" } }) },
      "@/lib/request": { readBody: async () => JSON.stringify({ published: after }) },
      "@/lib/prisma": { prisma: { article: {
        findUnique: async () => ({ authorId: "author", published: before, publishedAt: null }),
        update: async () => ({ id: "story", published: after, publishedAt: null }),
      } } },
      "@/lib/email/notifications": notifications(notices),
    });
    const response = await handler(new Request("http://localhost"), { params: Promise.resolve({ id: "story" }) });
    assert.equal(response.status, 200);
    assert.deepEqual(notices.map(({ userId, event }) => ({ userId, event })), before === after ? [] : [{ userId: "author", event: after ? "story-published" : "story-unpublished" }]);
  });
}

test("failed publication does not send a success email", async () => {
  const notices: Notice[] = [];
  const handler = loadPost("app/api/articles/[id]/publish/route.ts", {
    "@/lib/auth": { auth: async () => ({ user: { id: "author" } }) },
    "@/lib/request": { readBody: async () => '{"published":true}' },
    "@/lib/prisma": { prisma: { article: {
      findUnique: async () => ({ authorId: "author", published: false, publishedAt: null }),
      update: async () => { throw new Error("database unavailable"); },
    } } },
    "@/lib/email/notifications": notifications(notices),
  });
  await assert.rejects(handler(new Request("http://localhost"), { params: Promise.resolve({ id: "story" }) }), /database unavailable/);
  assert.equal(notices.length, 0);
});

for (const scenario of [
  { writer: "reader", parent: null, expected: [["author", "comment-received"]] },
  { writer: "author", parent: null, expected: [] },
  { writer: "reader", parent: "author", expected: [["author", "reply-received"]] },
  { writer: "reader", parent: "reader", expected: [["author", "comment-received"]] },
  { writer: "author", parent: "reader", expected: [["reader", "reply-received"]] },
  { writer: "reader", parent: "another-reader", expected: [["another-reader", "reply-received"], ["author", "comment-received"]] },
  { writer: null, parent: "reader", expected: [["reader", "reply-received"], ["author", "comment-received"]] },
]) {
  test(`comment by ${scenario.writer ?? "guest"}, parent ${scenario.parent}: intended recipients only`, async () => {
    const notices: Notice[] = [];
    const input = { body: "Private comment content", parentId: scenario.parent ? "parent" : undefined, guestName: "Guest", turnstileToken: "verified" };
    const handler = loadPost("app/api/articles/[id]/comments/route.ts", {
      "@/lib/request": { readJson: async () => input },
      "@/lib/rate-limit": { rateLimit: async () => ({ ok: true }) },
      "@/lib/turnstile": { verifyTurnstile: async () => true },
      "@/lib/engagement": { currentVoter: async () => ({ userId: scenario.writer, voterId: "voter" }) },
      "@/lib/comments": { commentInput: { safeParse: () => ({ success: true, data: input }) }, commentSelect: {}, toCommentView: () => ({ id: "comment" }) },
      "@/lib/prisma": { prisma: {
        article: { findFirst: async () => ({ authorId: "author", slug: "the-story", author: { username: "writer" } }) },
        comment: { findFirst: async () => ({ id: "parent", authorId: scenario.parent }), create: async () => ({ id: "comment" }) },
      } },
      "@/lib/email/notifications": notifications(notices),
    });
    const response = await handler(new Request("http://localhost"), { params: Promise.resolve({ id: "story" }) });
    assert.equal(response.status, 201);
    assert.deepEqual(notices.map(({ userId, event }) => [userId, event]), scenario.expected);
    assert.ok(!JSON.stringify(notices).includes(input.body));
    for (const notice of notices) assert.equal(Reflect.get(notice.options as object, "actionPath"), "/writer/the-story");
  });
}
