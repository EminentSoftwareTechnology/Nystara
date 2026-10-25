import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { unsubscribeToken, unsubscribeUserId } from "../lib/email/unsubscribe";

type Handler = (request: Request) => Promise<Response>;

function loadHandlers(path: string, imports: Record<string, unknown>): Record<string, Handler> {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
  const exports: Record<string, Handler> = {};
  const require = createRequire(import.meta.url);
  runInNewContext(outputText, { exports, Request, Response, URL, encodeURIComponent, require: (id: string) => id in imports ? imports[id] : require(id) });
  return exports;
}

process.env.NEXTAUTH_SECRET = "preferences-test-secret-with-at-least-32-characters";

function unsubscribeHandlers(writes: unknown[], activityEmails = true) {
  return loadHandlers("app/unsubscribe/route.ts", {
    "@/lib/email/unsubscribe": { unsubscribeUserId },
    "@/lib/prisma": { prisma: { user: { findUnique: async () => ({ activityEmails }), updateMany: async (args: unknown) => { writes.push(args); return { count: 1 }; } } } },
  });
}

test("unsubscribe GET renders confirmation without changing any preference", async () => {
  const writes: unknown[] = [];
  const { GET } = unsubscribeHandlers(writes);
  const token = await unsubscribeToken("owner");
  const response = await GET(new Request(`http://localhost/unsubscribe?token=${token}`));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /method="post"/);
  assert.match(html, /essential account and security messages will continue/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(writes.length, 0);
});

test("signed unsubscribe POST is repeatable and changes only its token owner’s activity flag", async () => {
  const writes: unknown[] = [];
  const { POST } = unsubscribeHandlers(writes);
  const token = await unsubscribeToken("owner");
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await POST(new Request(`http://localhost/unsubscribe?token=${token}&userId=someone-else`, { method: "POST", body: "List-Unsubscribe=One-Click" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { unsubscribed: true });
  }
  const expected = { where: { id: "owner" }, data: { activityEmails: false } };
  assert.deepEqual(JSON.parse(JSON.stringify(writes)), [expected, expected]);
});

test("unsubscribe HTML form redirects after applying the signed preference", async () => {
  const writes: unknown[] = [];
  const { POST } = unsubscribeHandlers(writes);
  const token = await unsubscribeToken("owner");
  const response = await POST(new Request(`http://localhost/unsubscribe?token=${token}`, { method: "POST", headers: { accept: "text/html" } }));
  assert.equal(response.status, 303);
  const destination = new URL(response.headers.get("location") ?? "");
  assert.equal(destination.pathname, "/unsubscribe");
  assert.equal(destination.searchParams.get("token"), token);
  assert.equal(destination.searchParams.get("done"), "1");
  assert.equal(writes.length, 1);
});

test("invalid or missing unsubscribe tokens never write preferences", async () => {
  const writes: unknown[] = [];
  const { GET, POST } = unsubscribeHandlers(writes);
  const token = await unsubscribeToken("owner");
  for (const value of ["", "not-a-token", token.slice(0, -8) + "tampered"]) {
    for (const [method, handler] of [["GET", GET], ["POST", POST]] as const) {
      const response = await handler(new Request(`http://localhost/unsubscribe?token=${value}`, { method }));
      assert.equal(response.status, 400);
    }
  }
  assert.equal(writes.length, 0);
});

function preferenceHandler(userId: string | null, body: unknown, writes: unknown[]) {
  return loadHandlers("app/api/me/notifications/route.ts", {
    "@/lib/auth": { auth: async () => userId ? { user: { id: userId } } : null },
    "@/lib/request": { readJson: async () => body },
    "@/lib/prisma": { prisma: { user: { update: async (args: unknown) => { writes.push(args); return {}; } } } },
  }).PATCH;
}

test("email preferences require authentication", async () => {
  const writes: unknown[] = [];
  const handler = preferenceHandler(null, { emailTheme: "sand", activityEmails: false }, writes);
  assert.equal((await handler(new Request("http://localhost", { method: "PATCH" }))).status, 401);
  assert.equal(writes.length, 0);
});

for (const body of [null, {}, { emailTheme: "system", activityEmails: true }, { emailTheme: "dark", activityEmails: "false" }, { emailTheme: "light" }, { activityEmails: false }]) {
  test(`invalid email preferences rejected: ${JSON.stringify(body)}`, async () => {
    const writes: unknown[] = [];
    const handler = preferenceHandler("owner", body, writes);
    assert.equal((await handler(new Request("http://localhost", { method: "PATCH" }))).status, 400);
    assert.equal(writes.length, 0);
  });
}

for (const emailTheme of ["light", "dark", "sand"]) {
  test(`${emailTheme} preference save applies only allowed fields to the authenticated owner`, async () => {
    const writes: unknown[] = [];
    const handler = preferenceHandler("owner", { emailTheme, activityEmails: false, id: "someone-else", role: "ADMIN", email: "attacker@example.test" }, writes);
    assert.equal((await handler(new Request("http://localhost", { method: "PATCH" }))).status, 200);
    assert.deepEqual(JSON.parse(JSON.stringify(writes)), [{ where: { id: "owner" }, data: { emailTheme, activityEmails: false } }]);
  });
}


test("done query alone cannot falsely announce an unsubscribe", async () => {
  const writes: unknown[] = [];
  const token = await unsubscribeToken("owner");
  const { GET } = unsubscribeHandlers(writes, true);
  for (const query of ["done=1", `done=1&token=${token}`]) {
    const response = await GET(new Request(`http://localhost/unsubscribe?${query}`));
    assert.doesNotMatch(await response.text(), /You’re unsubscribed/);
  }
  assert.equal(writes.length, 0);
});

test("done confirmation verifies stored activity preference without writing", async () => {
  const writes: unknown[] = [];
  const token = await unsubscribeToken("owner");
  const { GET } = unsubscribeHandlers(writes, false);
  const response = await GET(new Request(`http://localhost/unsubscribe?done=1&token=${token}`));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /You’re unsubscribed/);
  assert.equal(writes.length, 0);
});
