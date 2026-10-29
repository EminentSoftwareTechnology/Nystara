import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { ModuleKind, transpileModule } from "typescript";
import * as chat from "../lib/ai-chat";
import { responseText } from "../lib/ai-editor";

type Handler = (request: Request) => Promise<Response>;
function handlers(identity: string | null, database: object = {}, globals: Record<string, unknown> = {}, pro = true) {
  const exports: Record<string, Handler> = {};
  const source = readFileSync(new URL("../app/api/ai/editor/route.ts", import.meta.url), "utf8");
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
  const require = createRequire(import.meta.url);
  const imports: Record<string, unknown> = {
    "@/lib/auth": { auth: async () => identity ? { user: { id: identity } } : null },
    "@/lib/prisma": { prisma: database },
    "@/lib/request": { readJson: (request: Request) => request.json(), isSameOriginWrite: (request: Request) => request.headers.get("origin") === "http://localhost:6100" },
    "@/lib/rate-limit": { rateLimit: async () => ({ ok: true }) },
    "@/lib/pro": { AI_DAILY_LIMIT: 30, getPlan: async () => ({ launched: true, subscribed: pro, pro }) },
    "@/lib/ai-chat": chat,
    "@/lib/ai-editor": { responseText },
  };
  runInNewContext(outputText, { exports, Buffer, Request, Response, URL, AbortSignal, process: { env: { NODE_ENV: "development", OPENAI_API_KEY: "test-placeholder" } }, fetch: () => { throw new Error("Unexpected provider call"); }, ...globals, require: (id: string) => id in imports ? imports[id] : require(id) });
  return exports;
}
function request(method = "GET", body?: object, id?: string, origin = "http://localhost:6100") {
  return new Request(`http://localhost:6100/api/ai/editor${id ? `?id=${id}` : ""}`, { method, headers: { origin, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

test("AI endpoints reject unauthenticated access and cross-origin writes before touching storage", async () => {
  const api = handlers(null);
  assert.equal((await api.GET(request())).status, 401);
  assert.equal((await api.POST(request("POST", { text: "hello" }))).status, 401);
  assert.equal((await api.DELETE(request("DELETE", undefined, "private"))).status, 401);
  assert.equal((await api.POST(request("POST", { text: "hello" }, undefined, "https://evil.test"))).status, 403);
});

test("GET and POST scope conversations to the authenticated user; delete cannot remove another user's chat", async () => {
  const seen: { where: { id: string; userId: string } }[] = [];
  const api = handlers("reader", { aiConversation: {
    findFirst: async (args: typeof seen[number]) => { seen.push(args); return null; },
    deleteMany: async (args: typeof seen[number]) => { seen.push(args); return { count: 0 }; },
  } });
  assert.equal((await api.GET(request("GET", undefined, "someone-elses-chat"))).status, 404);
  assert.equal((await api.POST(request("POST", { text: "steal this", conversationId: "someone-elses-chat" }))).status, 404);
  assert.equal((await api.DELETE(request("DELETE", undefined, "someone-elses-chat"))).status, 200);
  assert.equal(seen.length, 3);
  for (const args of seen) {
    assert.equal(args.where.userId, "reader");
    assert.equal(args.where.id, "someone-elses-chat");
  }
});

test("members without Pro are refused before any storage or provider work", async () => {
  const api = handlers("reader", {}, {}, false);
  assert.equal((await api.POST(request("POST", { text: "hello" }))).status, 403);
});

test("invalid AI files are rejected before database/provider work", async () => {
  const api = handlers("reader");
  assert.equal((await api.POST(request("POST", { text: "edit this", attachments: [{ name: "file.exe", type: "application/octet-stream", data: "aGVsbG8=" }] }))).status, 400);
  assert.equal((await api.POST(request("POST", { text: " " }))).status, 400);
});

test("conversation retrieval returns file metadata without leaking stored file bytes", async () => {
  const api = handlers("reader", { aiConversation: { findFirst: async () => ({ messages: [{ id: "message", role: "user", content: "draft", attachments: [{ name: "draft.txt", type: "text/plain", data: "c2VjcmV0" }] }] }) } });
  const response = await api.GET(request("GET", undefined, "own-chat"));
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /draft.txt/);
  assert.doesNotMatch(body, /c2VjcmV0/);
});

test("AI creates a private persisted conversation with a real Responses-shaped provider reply", async () => {
  let providerCalls = 0;
  let writes = 0;
  const api = handlers("reader", { $transaction: async (callback: (tx: object) => Promise<unknown>) => callback({
    aiConversation: { create: async (args: { data: { userId: string; title: string } }) => { assert.equal(args.data.userId, "reader"); return { id: "new-chat", title: args.data.title }; } },
    aiMessage: { create: async (args: { data: { role: string; content: string } }) => { writes++; return { id: `message-${writes}`, ...args.data }; } },
  }) }, { fetch: async (url: string, options: { body: string }) => {
    providerCalls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    const payload = JSON.parse(options.body) as { store: boolean; input: { content: { text: string }[] }[] };
    assert.equal(payload.store, false);
    assert.equal(payload.input[0].content[0].text, "Please help outline my story");
    return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: "Start with an opening scene." }] }] });
  } });
  const response = await api.POST(request("POST", { text: "Please help outline my story" }));
  assert.equal(response.status, 200);
  const data = await response.json() as { conversation: { id: string }; messages: { content: string }[] };
  assert.equal(data.conversation.id, "new-chat");
  assert.equal(data.messages[1].content, "Start with an opening scene.");
  assert.equal(providerCalls, 1);
  assert.equal(writes, 2);
});
