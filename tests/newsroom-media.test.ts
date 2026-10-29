import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import * as content from "../prisma/newsroom/content";
import * as storageUrls from "../lib/storage-url";
import { newsroomImages, type writeNewsroomImages } from "../prisma/newsroom/media";

const storage = { account: "a".repeat(32), accessKeyId: "test-only", secretAccessKey: "test-only", bucket: "test", publicUrl: "https://media.example.test" };
const diagram = { diagram: { title: "A test design", stages: ["Collect", "Validate", "Process", "Store", "Review"] } };
type Upload = { Key: string; ContentType: string; Body: Buffer };

function uploader(fail = false) {
  const uploads: Upload[] = [];
  let settled = 0;
  let destroyed = false;
  const source = readFileSync(new URL("../prisma/newsroom/media.ts", import.meta.url), "utf8");
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, esModuleInterop: true } });
  const require = createRequire(import.meta.url);
  const exports = {};
  const imports: Record<string, unknown> = {
    "./content": content,
    "../../lib/storage-url": storageUrls,
    "@aws-sdk/client-s3": { PutObjectCommand: class { constructor(readonly input: Upload) {} } },
    "../../lib/r2": { r2Client: () => ({
      send: async (command: { input: Upload }) => {
        uploads.push(command.input);
        await Promise.resolve();
        settled++;
        if (fail && command.input.Key.includes("diagram")) throw new Error("Upload rejected");
      },
      destroy: () => { assert.equal(settled, 2); destroyed = true; },
    }) },
  };
  runInNewContext(outputText, { exports, Buffer, AbortSignal, process, require: (id: string) => id in imports ? imports[id] : require(id) });
  return { ...(exports as { writeNewsroomImages: typeof writeNewsroomImages }), uploads, destroyed: () => destroyed };
}

test("production media URLs stay under the managed author's R2 prefix", () => {
  const remote = newsroomImages("author", "article", storage);
  assert.equal(remote.diagram, "https://media.example.test/stories/author/article-v2-diagram.webp");
  assert.equal(remote.cover, "https://media.example.test/stories/author/article-v2-cover.webp");
  assert.equal(newsroomImages("author", "article", null).diagram, "/demo/newsroom/article.webp");
});

test("both generated images upload as WebP before the R2 client closes", async () => {
  const client = uploader();
  await client.writeNewsroomImages("author", "article", diagram, "Robotics", 1, storage);
  assert.equal(client.uploads.length, 2);
  assert.deepEqual(client.uploads.map((upload) => upload.Key).sort(), Object.values(newsroomImages("author", "article", storage)).map((url) => new URL(url).pathname.slice(1)).sort());
  assert.ok(client.uploads.every((upload) => upload.ContentType === "image/webp" && upload.Key.startsWith("stories/author/") && upload.Body.toString("ascii", 8, 12) === "WEBP"));
  assert.equal(client.destroyed(), true);
});

test("a partial media failure prevents publication and waits for both uploads to settle", async () => {
  const client = uploader(true);
  await assert.rejects(client.writeNewsroomImages("author", "article", diagram, "AI", 2, storage), /article was not published/);
  assert.equal(client.destroyed(), true);
});
