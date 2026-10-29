import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { z } from "zod";
import * as content from "../prisma/newsroom/content";
import * as video from "../lib/video";
import { responseText } from "../lib/ai-editor";

type Provider = { generate: <T>(schema: z.ZodType<T>, prompt: string, search?: boolean, validate?: (value: T) => void) => Promise<{ value: T }> };

function provider(responses: Response[]) {
  const calls: { input: { content: string }[]; store: boolean }[] = [];
  const source = readFileSync(new URL("../prisma/newsroom/openai.ts", import.meta.url), "utf8");
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
  const require = createRequire(import.meta.url);
  const exports = {};
  const imports: Record<string, unknown> = { "./content": content, "../../lib/video": video, "../../lib/ai-editor": { responseText } };
  runInNewContext(outputText, {
    exports, URL, AbortSignal, Error, SyntaxError,
    process: { env: { OPENAI_API_KEY: "test-only", OPENAI_MODEL: "test-model" } },
    console: { warn: () => undefined },
    setTimeout: (callback: () => void) => { callback(); return 0; },
    fetch: async (_url: string, options: { body: string }) => {
      calls.push(JSON.parse(options.body));
      assert.ok(responses.length, "Unexpected additional paid attempt");
      return responses.shift();
    },
    require: (id: string) => id in imports ? imports[id] : require(id),
  });
  return { ...(exports as Provider), calls };
}

const reply = (sourceIds: number[]) => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ sourceIds }) }] }] });
const schema = z.object({ sourceIds: z.array(z.number()) });

test("invalid article citations receive one corrective attempt before returning validated content", async () => {
  const client = provider([reply([1, 1]), reply([1, 2])]);
  const result = await client.generate(schema, "Write an article", false, (draft) => {
    if (new Set(draft.sourceIds).size < 2) throw new content.DraftValidationError("Use two distinct sources");
  });
  assert.deepEqual(result.value.sourceIds, [1, 2]);
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[1].input[1].content, /Correct.*distinct sources/);
  assert.ok(client.calls.every((call) => call.store === false));
});

test("incomplete responses and transient rejections cannot trigger more than one paid retry", async () => {
  const incomplete = () => Response.json({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] });
  for (const responses of [[incomplete(), incomplete()], [new Response("busy", { status: 429 }), new Response("busy", { status: 429 })]]) {
    const client = provider(responses);
    await assert.rejects(client.generate(schema, "Write"));
    assert.equal(client.calls.length, 2);
  }
});

test("credential rejection stops immediately without a paid retry", async () => {
  const client = provider([new Response("private provider details", { status: 401 })]);
  await assert.rejects(client.generate(schema, "Write"), /HTTP 401/);
  assert.equal(client.calls.length, 1);
});
