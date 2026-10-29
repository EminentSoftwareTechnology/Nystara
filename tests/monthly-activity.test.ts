import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { ModuleKind, transpileModule } from "typescript";
import { isOwnedProfileImage, isStorageImage, storyStoragePrefix } from "../lib/storage-url";
import { safeNext } from "../lib/safe-redirect";

test("article return paths reject external and browser-normalized authority redirects", () => {
  for (const raw of ["https://evil.test", "//evil.test", "/\\evil.test", "/\n/evil.test", "/\t/evil.test", "/\u0000/evil.test"]) assert.equal(safeNext(raw), "/");
  assert.equal(safeNext("/writer/story?from=share"), "/writer/story?from=share");
});

function load(path: string, imports: Record<string, unknown>): Record<string, unknown> {
  const { outputText } = transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } });
  const exports = {};
  const require = createRequire(import.meta.url);
  runInNewContext(outputText, { exports, Date, require: (id: string) => id in imports ? imports[id] : require(id) });
  return exports;
}

test("activity endpoint requires a real verified user and derives the UTC day itself", async () => {
  for (const identity of ["anonymous", "synthetic", "real"]) {
    const writes: { data: { userId: string; day: Date }[]; skipDuplicates: boolean }[] = [];
    const { POST } = load("app/api/me/activity/route.ts", {
      "@/lib/auth": { auth: async () => identity === "anonymous" ? null : { user: { id: "owner" } } },
      "@/lib/prisma": { prisma: {
        user: { findUnique: async () => ({ isSynthetic: identity === "synthetic" }) },
        userActivityDay: { createMany: async (input: typeof writes[number]) => { writes.push(input); } },
      } },
    }) as { POST: () => Promise<Response> };
    assert.equal((await POST()).status, identity === "anonymous" ? 401 : 204);
    assert.equal(writes.length, identity === "real" ? 1 : 0);
    if (identity === "real") {
      assert.equal(writes[0].skipDuplicates, true);
      assert.equal(writes[0].data[0].userId, "owner");
      assert.match(writes[0].data[0].day.toISOString(), /T00:00:00.000Z$/);
    }
  }
});

test("monthly history zero-fills 12 calendar months across a year boundary", async () => {
  const { monthlyActiveUsers } = load("lib/admin-activity.ts", {
    "@/lib/prisma": { prisma: { $queryRaw: async () => [{ month: "2026-12", users: 7 }, { month: "2027-01", users: 2 }] } },
  }) as { monthlyActiveUsers: (date: Date) => Promise<{ label: string; value: number }[]> };
  const points = await monthlyActiveUsers(new Date("2027-01-01T00:00:00Z"));
  assert.equal(points.length, 12);
  assert.equal(points[0].label, "2026-02");
  assert.equal(points[0].value, 0);
  assert.equal(points[10].value, 7);
  assert.equal(points[11].value, 2);
});

test("production R2 namespace isolates image writes, ownership and erasure prefixes", () => {
  const before = { prefix: process.env.R2_KEY_PREFIX, url: process.env.R2_PUBLIC_URL };
  process.env.R2_PUBLIC_URL = "https://media.example.test";
  process.env.R2_KEY_PREFIX = "production/";
  try {
    assert.equal(storyStoragePrefix("author"), "production/stories/author/");
    assert.equal(isStorageImage("https://media.example.test/stories/author/1234.webp"), false);
    assert.equal(isOwnedProfileImage("https://media.example.test/production/stories/author/1234.webp", "author"), true);
    assert.equal(isOwnedProfileImage("https://media.example.test/production/stories/other/1234.webp", "author"), false);
    process.env.R2_KEY_PREFIX = "../";
    assert.throws(() => storyStoragePrefix("author"));
  } finally {
    if (before.prefix === undefined) delete process.env.R2_KEY_PREFIX; else process.env.R2_KEY_PREFIX = before.prefix;
    if (before.url === undefined) delete process.env.R2_PUBLIC_URL; else process.env.R2_PUBLIC_URL = before.url;
  }
});
