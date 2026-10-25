import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { ModuleKind, transpileModule } from "typescript";
import sharp from "sharp";
import { InvalidImage, toWebp } from "../lib/image-pipeline";
import { imageType } from "../lib/image-type";
import { isOwnedProfileImage } from "../lib/storage-url";
import { parseVideoUrl, safeVideoThumbnail, videoUrl } from "../lib/video";

type Handler = (request: Request) => Promise<Response>;
function handlers(path: string, imports: Record<string, unknown>, globals: Record<string, unknown> = {}): Record<string, Handler> {
  const exports: Record<string, Handler> = {};
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
  const require = createRequire(import.meta.url);
  runInNewContext(outputText, { exports, Buffer, Request, Response, URL, AbortSignal, ...globals, require: (id: string) => id in imports ? imports[id] : require(id) });
  return exports;
}
const request = (data: object) => new Request("http://localhost/api/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

for (const identity of ["reader", "admin", "anonymous"] as const) {
  test(`avatar upload authenticates ${identity}, re-encodes and stores only in the caller's prefix`, async () => {
    const writes: { input: { Key: string; Body: Buffer; ContentType: string } }[] = [];
    let destroyed = false;
    const { POST } = handlers("app/api/media/route.ts", {
      "@/lib/auth": { auth: async () => identity === "reader" ? { user: { id: "reader" } } : null },
      "@/lib/admin-auth": { getVerifiedAdminSession: async () => identity === "admin" ? { sub: "admin" } : null },
      "@/lib/request": { readJson: (req: Request) => req.json() },
      "@/lib/rate-limit": { rateLimit: async () => ({ ok: true }) },
      "@/lib/image-type": { imageType },
      "@/lib/image-pipeline": { InvalidImage, toWebp },
      "@/lib/clamav": { clamavConfig: () => null },
      "@/lib/r2": { r2Config: () => ({ bucket: "test", publicUrl: "https://media.example.test" }), r2Client: () => ({ send: async (command: { input: { Key: string; Body: Buffer; ContentType: string } }) => { writes.push(command); }, destroy: () => { destroyed = true; } }) },
    });
    const bytes = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#14224a" } }).png().toBuffer();
    const response = await POST(request({ purpose: "avatar", type: "image/png", data: bytes.toString("base64"), userId: "victim" }));
    if (identity === "anonymous") { assert.equal(response.status, 401); assert.equal(writes.length, 0); return; }
    assert.equal(response.status, 201);
    assert.match(writes[0].input.Key, new RegExp(`^stories/${identity}/[a-f0-9-]+\\.webp$`));
    assert.equal(writes[0].input.ContentType, "image/webp");
    assert.equal((await sharp(writes[0].input.Body).metadata()).width, 512);
    assert.equal(destroyed, true);
  });
}

test("profile PATCH persists own uploaded photo or removal, rejects external and cross-user photos", async () => {
  process.env.R2_PUBLIC_URL = "https://media.example.test";
  try {
    const writes: { where: { id: string }; data: { avatarUrl?: string | null } }[] = [];
    const { PATCH } = handlers("app/api/me/route.ts", {
      "@/lib/auth": { authForAccountSetup: async () => ({ user: { id: "owner" } }) },
      "@/lib/prisma": { prisma: { user: { update: async (args: typeof writes[number]) => { writes.push(args); } } } },
      "@/lib/request": { readJson: (req: Request) => req.json() },
      "@/lib/gdpr": {}, "@/lib/email/notifications": { notifyUser: async () => undefined },
      "@/lib/storage-url": { isOwnedProfileImage },
    });
    for (const avatarUrl of ["", "https://media.example.test/stories/other/1234-abcd.webp", "https://evil.test/photo.png"]) assert.equal((await PATCH(request({ name: "Reader", avatarUrl }))).status, 400);
    assert.equal(writes.length, 0);
    for (const avatarUrl of ["https://media.example.test/stories/owner/1234-abcd.webp", null]) {
      assert.equal((await PATCH(request({ name: "Reader", avatarUrl }))).status, 200);
      assert.equal(writes.at(-1)?.where.id, "owner");
      assert.equal(writes.at(-1)?.data.avatarUrl, avatarUrl);
    }
  } finally { delete process.env.R2_PUBLIC_URL; }
});

test("public video metadata uses only canonical provider endpoints; direct files are never fetched server-side", async () => {
  const requests: string[] = [];
  const { GET } = handlers("app/api/videos/route.ts", {
    "@/lib/auth": {}, "@/lib/request": {},
    "@/lib/video": { parseVideoUrl, safeVideoThumbnail, videoUrl },
  }, { fetch: async (url: string, options: { redirect: string }) => {
    requests.push(url);
    assert.equal(options.redirect, "error");
    return Response.json({ title: "A video", thumbnail_url: "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg", html: '<iframe src="https://evil.test">' });
  } });
  assert.equal((await GET(new Request("http://localhost/api/videos?url=" + encodeURIComponent("https://media.example.test/a.mp4")))).status, 200);
  assert.equal(requests.length, 0);
  assert.equal((await GET(new Request("http://localhost/api/videos?url=" + encodeURIComponent("https://evil.test/not-video")))).status, 400);
  assert.equal(requests.length, 0);
  const response = await GET(new Request("http://localhost/api/videos?url=" + encodeURIComponent("https://youtu.be/M7lc1UVf-VE")));
  assert.equal(response.status, 200);
  assert.ok(requests[0].startsWith("https://www.youtube.com/oembed?url="));
  assert.equal((await response.text()).includes("iframe"), false);
});
