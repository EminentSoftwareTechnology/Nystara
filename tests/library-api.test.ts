import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { ModuleKind, transpileModule } from "typescript";
import { isSameOriginWrite } from "../lib/request";
import { extractExcerpt } from "../lib/paywall";
import { hasPremiumAccess } from "../lib/premium";

type Context = { params: Promise<{ id: string }> };
type Handler = (request: Request, context: Context) => Promise<Response>;
function routes(
  path: string,
  prisma: object,
  identity: string | null = "reader",
) {
  const exports: Record<string, Handler> = {};
  const { outputText } = transpileModule(
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
    { compilerOptions: { module: ModuleKind.CommonJS } },
  );
  const imports: Record<string, unknown> = {
    "@/lib/auth": {
      auth: async () => (identity ? { user: { id: identity } } : null),
    },
    "@/lib/prisma": { prisma },
    "@/lib/paywall": { extractExcerpt },
    "@/lib/premium": { hasPremiumAccess },
    "@/lib/rate-limit": { rateLimit: async () => ({ ok: true }) },
    "@/lib/request": {
      readJson: (request: Request) => request.json(),
      isSameOriginWrite,
    },
  };
  const require = createRequire(import.meta.url);
  runInNewContext(outputText, {
    exports,
    Request,
    Response,
    URL,
    require: (id: string) => (id in imports ? imports[id] : require(id)),
  });
  return exports;
}
function request(data: object, origin = "http://localhost:6100") {
  return new Request("http://localhost:6100/api/me/library", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
const context = { params: Promise.resolve({ id: "writer" }) };

async function withOrigin(run: () => Promise<void>) {
  const previous = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "http://localhost:6100";
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previous;
  }
}

test("library mutations reject anonymous and cross-origin requests before database access", async () =>
  withOrigin(async () => {
    for (const identity of [null, "reader"]) {
      const { POST } = routes("app/api/me/library/route.ts", {}, identity);
      const response = await POST(
        request(
          { action: "createList", name: "Private ideas" },
          identity ? "https://other.example" : undefined,
        ),
        context,
      );
      assert.equal(response.status, identity ? 403 : 401);
    }
  }));

test("creating a named list binds ownership to session and validates empty names", async () =>
  withOrigin(async () => {
    const created: { userId: string; name: string; isPublic: boolean }[] = [];
    const { POST } = routes("app/api/me/library/route.ts", {
      readingList: {
        count: async () => 0,
        create: async ({ data }: { data: (typeof created)[number] }) => {
          created.push(data);
          return { id: "list", ...data };
        },
      },
    });
    assert.equal(
      (await POST(request({ action: "createList", name: "   " }), context))
        .status,
      400,
    );
    assert.equal(
      (
        await POST(
          request({
            action: "createList",
            name: "  Design inspiration  ",
            userId: "victim",
            isPublic: true,
          }),
          context,
        )
      ).status,
      200,
    );
    assert.equal(created.length, 1);
    assert.equal(created[0].userId, "reader");
    assert.equal(created[0].name, "Design inspiration");
    assert.equal(created[0].isPublic, true);
  }));

test("list membership cannot be written by another reader and own membership persists", async () =>
  withOrigin(async () => {
    const membership = new Set<string>();
    const prisma = {
      article: {
        findFirst: async () => ({ id: "story", contentText: "A passage." }),
      },
      readingList: {
        findFirst: async ({
          where,
        }: {
          where: { id: string; userId: string };
        }) =>
          where.id === "own-list" && where.userId === "reader"
            ? { id: where.id }
            : null,
      },
      readingListItem: {
        upsert: async ({
          create,
        }: {
          create: { listId: string; articleId: string };
        }) => membership.add(`${create.listId}/${create.articleId}`),
        deleteMany: async ({
          where,
        }: {
          where: { listId: string; articleId: string };
        }) => membership.delete(`${where.listId}/${where.articleId}`),
      },
    };
    const { POST } = routes("app/api/me/library/route.ts", prisma);
    assert.equal(
      (
        await POST(
          request({
            action: "listItem",
            listId: "someone-elses-list",
            articleId: "story",
            saved: true,
          }),
          context,
        )
      ).status,
      404,
    );
    assert.equal(membership.size, 0);
    assert.equal(
      (
        await POST(
          request({
            action: "listItem",
            listId: "own-list",
            articleId: "story",
            saved: true,
          }),
          context,
        )
      ).status,
      200,
    );
    assert.ok(membership.has("own-list/story"));
    assert.equal(
      (
        await POST(
          request({
            action: "listItem",
            listId: "own-list",
            articleId: "story",
            saved: false,
          }),
          context,
        )
      ).status,
      200,
    );
    assert.equal(membership.size, 0);
  }));

test("bookmark writes, highlight deletion and history clearing use authenticated reader scope", async () =>
  withOrigin(async () => {
    const scopes: string[] = [];
    const { POST } = routes("app/api/me/library/route.ts", {
      article: {
        findFirst: async () => ({
          id: "story",
          contentText: "A passage worth keeping.",
        }),
      },
      bookmark: {
        upsert: async ({ create }: { create: { userId: string } }) =>
          scopes.push(create.userId),
      },
      highlight: {
        deleteMany: async ({ where }: { where: { userId: string } }) =>
          scopes.push(where.userId),
      },
      user: {
        update: async ({ where, data }: { where: { id: string }; data: { readingHistoryClearedAt: Date } }) => {
          scopes.push(where.id);
          assert.ok(data.readingHistoryClearedAt.getTime() <= Date.now());
        },
      },
      articleView: { deleteMany: async () => { assert.fail("Clearing visible history must preserve paid-read quota records"); } },
    });
    for (const input of [
      { action: "bookmark", articleId: "story", saved: true },
      { action: "deleteHighlight", highlightId: "other-highlight" },
      { action: "clearHistory" },
    ])
      assert.equal(
        (await POST(request({ ...input, userId: "victim" }), context)).status,
        200,
      );
    assert.deepEqual(scopes, ["reader", "reader", "reader"]);
    assert.equal(
      (
        await POST(
          request({
            action: "highlight",
            articleId: "story",
            quote: "Invented text",
          }),
          context,
        )
      ).status,
      400,
    );
  }));

test("private lists cannot be saved by another reader", async () =>
  withOrigin(async () => {
    let writes = 0;
    const { POST } = routes("app/api/me/library/route.ts", {
      readingList: {
        findFirst: async ({ where }: { where: { isPublic: boolean } }) => {
          assert.equal(where.isPublic, true);
          return null;
        },
      },
      savedList: {
        upsert: async () => {
          writes++;
        },
      },
    });
    assert.equal(
      (
        await POST(
          request({ action: "saveList", listId: "private-list", saved: true }),
          context,
        )
      ).status,
      404,
    );
    assert.equal(writes, 0);
  }));

test("following persists idempotently for authenticated reader and rejects self-follow", async () =>
  withOrigin(async () => {
    const follows = new Set<string>();
    const prisma = {
      user: { findUnique: async () => ({ id: "writer" }) },
      follow: {
        upsert: async ({
          create,
        }: {
          create: { followerId: string; followingId: string };
        }) => follows.add(`${create.followerId}/${create.followingId}`),
        deleteMany: async ({
          where,
        }: {
          where: { followerId: string; followingId: string };
        }) => follows.delete(`${where.followerId}/${where.followingId}`),
      },
    };
    const { PUT, DELETE } = routes(
      "app/api/users/[id]/follow/route.ts",
      prisma,
    );
    for (let i = 0; i < 2; i++)
      assert.equal((await PUT(request({}), context)).status, 200);
    assert.equal(follows.size, 1);
    assert.ok(follows.has("reader/writer"));
    assert.equal(
      (await PUT(request({}), { params: Promise.resolve({ id: "reader" }) }))
        .status,
      400,
    );
    assert.equal((await DELETE(request({}), context)).status, 200);
    assert.equal(follows.size, 0);
    const anonymous = routes("app/api/users/[id]/follow/route.ts", {}, null);
    assert.equal((await anonymous.PUT(request({}), context)).status, 401);
    assert.equal(
      (await PUT(request({}, "https://evil.example"), context)).status,
      403,
    );
  }));


test("paid highlights cannot probe inaccessible story text; entitled readers keep full highlighting", async () =>
  withOrigin(async () => {
    const contentText = `${"public ".repeat(300)}private passage beyond the paywall`;
    for (const entitled of [false, true]) {
      const writes: string[] = [];
      const { POST } = routes("app/api/me/library/route.ts", {
        article: { findFirst: async () => ({ id: "paid-story", contentText, memberOnly: true, authorId: "writer", unlisted: false }) },
        subscription: { findUnique: async () => null },
        articleView: { findFirst: async ({ where }: { where: { visitorId: string; articleId: string } }) => {
          assert.equal(where.visitorId, "reader"); assert.equal(where.articleId, "paid-story");
          return entitled ? { id: "entitled-read" } : null;
        } },
        highlight: { create: async ({ data }: { data: { quote: string } }) => { writes.push(data.quote); } },
      });
      const response = await POST(request({ action: "highlight", articleId: "paid-story", quote: "private passage beyond the paywall" }), context);
      assert.equal(response.status, entitled ? 200 : 400);
      assert.equal(writes.length, entitled ? 1 : 0);
      if (!entitled) {
        assert.equal((await POST(request({ action: "highlight", articleId: "paid-story", quote: "public public" }), context)).status, 200);
        assert.equal((await POST(request({ action: "highlight", articleId: "paid-story", quote: "nonexistent private phrase" }), context)).status, 400);
      }
    }
  }));

test("unlisted stories cannot enter public collections and stale saves remain removable", async () =>
  withOrigin(async () => {
    let removed = false;
    const { POST } = routes("app/api/me/library/route.ts", {
      article: { findFirst: async () => ({ id: "unlisted", contentText: "", unlisted: true }) },
      readingList: { findFirst: async () => ({ id: "public-list", isPublic: true }) },
      savedList: { deleteMany: async ({ where }: { where: { userId: string } }) => { assert.equal(where.userId, "reader"); removed = true; } },
    });
    assert.equal((await POST(request({ action: "listItem", articleId: "unlisted", listId: "public-list", saved: true }), context)).status, 400);
    assert.equal((await POST(request({ action: "saveList", listId: "no-longer-public", saved: false }), context)).status, 200);
    assert.equal(removed, true);
  }));
