import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { ModuleKind, transpileModule } from "typescript";

test("new export sections scope every query to the caller and paginate large collections", async () => {
  const source = readFileSync(new URL("../app/api/me/export/route.ts", import.meta.url), "utf8");
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
  const exports: { GET?: (request: NextRequest) => Promise<Response> } = {};
  const require = createRequire(import.meta.url);
  const calls: { model: string; where: Record<string, unknown>; take: number }[] = [];
  const database = Object.fromEntries(["readingList", "readingListItem", "savedList", "highlight", "topicFollow", "aiConversation", "aiMessage"].map((model) => [model, { findMany: async (args: { where: Record<string, unknown>; take: number }) => {
    calls.push({ model, ...args });
    return Array.from({ length: 21 }, (_, index) => ({ id: `id-${String(index).padStart(2, "0")}`, articleId: `article-${index}`, listId: `list-${index}`, tagId: `tag-${index}` }));
  } }]));
  const imports: Record<string, unknown> = {
    "@/lib/auth": { auth: async () => ({ user: { id: "export-owner" } }) },
    "@/lib/prisma": { prisma: database },
    "@/lib/audit": { audit: () => undefined },
    "@/lib/rate-limit": { rateLimit: async () => ({ ok: true }) },
  };
  runInNewContext(outputText, { exports, URL, Date, encodeURIComponent, require: (id: string) => id in imports ? imports[id] : require(id) });
  assert.ok(exports.GET);
  for (const section of ["readingLists", "readingListItems", "savedLists", "highlights", "topicFollows", "aiConversations", "aiMessages"]) {
    const response = await exports.GET(new NextRequest(`http://localhost:6100/api/me/export?section=${section}`));
    assert.equal(response.status, 200);
    const data = await response.json() as { records: object[]; next: string };
    assert.equal(data.records.length, 20);
    assert.match(data.next, new RegExp(`section=${section}&cursor=`));
    assert.match(response.headers.get("cache-control")!, /no-store/);
    const query = calls.at(-1)!;
    assert.equal(query.take, 21);
    assert.match(JSON.stringify(query.where), /export-owner/);
    if (section === "aiMessages") assert.equal(JSON.stringify(query.where), '{"conversation":{"userId":"export-owner"}}');
    if (section === "readingListItems") assert.equal(JSON.stringify(query.where), '{"list":{"userId":"export-owner"}}');
  }
});
