import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { ModuleKind, transpileModule } from "typescript";

test("a failed Redis socket reconnects on the next request without a late event evicting the replacement", async () => {
  const clients: FakeClient[] = [];
  class FakeClient extends EventEmitter {
    failed = false;
    async connect() { return this; }
    withCommandOptions() { return this; }
    async eval() {
      if (this.failed) throw new Error("Socket closed");
      return [1, 60_000];
    }
  }
  const { outputText } = transpileModule(readFileSync(new URL("../lib/rate-limit.ts", import.meta.url), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS } });
  const exports = {};
  const require = createRequire(import.meta.url);
  runInNewContext(outputText, {
    exports,
    process: { env: { REDIS_URL: "redis://localhost", NODE_ENV: "production", NEXTAUTH_SECRET: "test-only" } },
    require: (id: string) => id === "redis" ? { createClient: () => { const client = new FakeClient(); clients.push(client); return client; } } : require(id),
  });
  const { rateLimit } = exports as { rateLimit: (key: string, limit: number, window: number) => Promise<{ ok: boolean }> };
  assert.equal((await rateLimit("before-restart", 5, 60_000)).ok, true);
  clients[0].failed = true;
  clients[0].emit("error", new Error("Socket closed unexpectedly"));
  assert.equal((await rateLimit("after-restart", 5, 60_000)).ok, true);
  assert.equal(clients.length, 2);
  clients[0].emit("end");
  assert.equal((await rateLimit("late-old-event", 5, 60_000)).ok, true);
  assert.equal(clients.length, 2);
});
