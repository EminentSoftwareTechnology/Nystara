import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { readJson, readBody, MAX_BODY_BYTES, PayloadTooLarge, parsePage, isSameOriginWrite } from "../lib/request";
import { getClientIp } from "../lib/client-ip";
import { contentSecurityPolicy } from "../lib/csp";
import { readerIdentity } from "../lib/visitor";
import { passwordSchema } from "../lib/password";
import { articleContent, coverImageUrl } from "../lib/article-schema";
import { rateLimit } from "../lib/rate-limit";
import { createAdminSession, verifyAdminToken } from "../lib/admin-session";
import { verifyTurnstile } from "../lib/turnstile";

process.env.NEXTAUTH_URL = "https://example.test";
process.env.NEXTAUTH_SECRET = "test-only-reader-secret-32-characters-long";
process.env.ADMIN_JWT_SECRET = "test-only-admin-secret-32-characters-long";
Object.assign(process.env, { NODE_ENV: "test" });
delete process.env.REDIS_URL;

test("CSRF rejects absent/null origins, wrong scheme/port and spoofed proxy host", () => {
  const request = (origin?: string) => new Request("https://example.test/api/me", { method: "DELETE", headers: { ...(origin ? { origin } : {}), "x-forwarded-host": "evil.test" } });
  assert.equal(isSameOriginWrite(request()), false);
  for (const origin of ["null", "https://evil.test", "http://example.test", "https://example.test:444"]) assert.equal(isSameOriginWrite(request(origin)), false);
  assert.equal(isSameOriginWrite(request("https://example.test")), true);
});

test("chunked bodies cannot bypass the byte limit without Content-Length", async () => {
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new Uint8Array(MAX_BODY_BYTES));
    controller.enqueue(new Uint8Array(1));
    controller.close();
  } });
  const req = new Request("https://example.test", { method: "POST", body, duplex: "half" } as RequestInit);
  await assert.rejects(readBody(req), PayloadTooLarge);
  assert.equal(await readJson(new Request("https://example.test", { method: "POST", body: "{" })), null);
  assert.deepEqual(await readJson(new Request("https://example.test", { method: "POST", body: '{"title":"hello"}' })), { title: "hello" });
});

test("page offsets remain bounded for malicious and non-finite inputs", () => {
  for (const value of ["Infinity", "-9", "1e309", "3garbage"]) assert.equal(parsePage(value), 1);
  assert.equal(parsePage("9".repeat(400)), 1000);
  assert.equal(parsePage("2"), 2);
});

test("untrusted forwarded IP headers cannot select limiter buckets", () => {
  delete process.env.TRUST_PROXY_IP;
  assert.equal(getClientIp(new Headers({ "x-forwarded-for": "1.2.3.4" })), "unknown");
  process.env.TRUST_PROXY_IP = "1";
  assert.equal(getClientIp(new Headers({ "x-forwarded-for": "spoofed, 127.0.0.1" })), "127.0.0.1");
  assert.equal(getClientIp(new Headers({ "x-forwarded-for": "garbage" })), "unknown");
  delete process.env.TRUST_PROXY_IP;
});

test("admin tokens require audience, claim types and a session version", async () => {
  const claims = { sub: "admin", email: "admin@example.test", role: "ADMIN", version: 2 };
  assert.deepEqual(await verifyAdminToken(await createAdminSession(claims)), claims);
  const token = await new SignJWT({ ...claims, version: undefined }).setProtectedHeader({ alg: "HS256" }).setAudience("techscribe:admin").setExpirationTime("1h").sign(new TextEncoder().encode(process.env.ADMIN_JWT_SECRET));
  assert.equal(await verifyAdminToken(token), null);
  const reader = await readerIdentity();
  assert.equal(await verifyAdminToken(reader.token!), null);
});

test("reader identities are random, signed and survive a valid cookie", async () => {
  const first = await readerIdentity();
  assert.match(first.id, /^anon-/);
  assert.notEqual((await readerIdentity()).id, first.id);
  assert.deepEqual(await readerIdentity(first.token!), { id: first.id, token: null });
  assert.notEqual((await readerIdentity("forged")).id, first.id);
});

test("bcrypt passwords reject truncation, including multi-byte characters", () => {
  assert.equal(passwordSchema.safeParse("x".repeat(72)).success, true);
  assert.equal(passwordSchema.safeParse("x".repeat(73)).success, false);
  assert.equal(passwordSchema.safeParse("😀".repeat(19)).success, false);
});

test("production CSP denies arbitrary inline scripts and unsafe eval", () => {
  Object.assign(process.env, { NODE_ENV: "production" });
  const policy = contentSecurityPolicy("unpredictable");
  const scripts = policy.split(";").find((value) => value.trim().startsWith("script-src"))!;
  assert.match(scripts, /nonce-unpredictable/);
  assert.doesNotMatch(scripts, /unsafe-inline|unsafe-eval/);
  Object.assign(process.env, { NODE_ENV: "test" });
});

test("content limits reject deep JSON and tracking/active image URLs", () => {
  let value: Record<string, unknown> = {};
  for (let i = 0; i < 30; i++) value = { child: value };
  assert.equal(articleContent.safeParse(value).success, false);
  for (const url of ["javascript:alert(1)", "https://tracker.test/pixel", "http://avatars.githubusercontent.com/a", "https://avatars.githubusercontent.com.evil.test/a", "https://user@avatars.githubusercontent.com/a"]) assert.equal(coverImageUrl.safeParse(url).success, false);
  assert.equal(coverImageUrl.safeParse("https://avatars.githubusercontent.com/a").success, true);
});

test("production fails closed without Redis and rejects Turnstile test keys", async () => {
  Object.assign(process.env, { NODE_ENV: "production" });
  process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
  assert.equal((await rateLimit("closed", 1, 60_000)).ok, false);
  assert.equal(await verifyTurnstile("anything"), false);
  Object.assign(process.env, { NODE_ENV: "test" });
});

test("proxy guards chunked payloads and CSRF before handlers", async () => {
  process.env.TRUST_PROXY_IP = "1";
  const { default: proxy } = await import("../proxy");
  const rejected = await proxy(new NextRequest("https://example.test/api/me", { method: "DELETE" }));
  assert.equal(rejected.status, 403);
  const big = await proxy(new NextRequest("https://example.test/api/articles", {
    method: "POST", headers: { origin: "https://example.test", "x-forwarded-for": "127.0.0.2", "content-length": String(MAX_BODY_BYTES + 1) }, body: "{}",
  }));
  assert.equal(big.status, 413);
  delete process.env.TRUST_PROXY_IP;
});

test("saturating the dev limiter does not reset existing blocked buckets", async () => {
  const key = "blocked";
  await rateLimit(key, 1, 60_000);
  assert.equal((await rateLimit(key, 1, 60_000)).ok, false);
  for (let i = 0; i < 50_001; i++) await rateLimit(`rotating:${i}`, 1, 60_000);
  assert.equal((await rateLimit(key, 1, 60_000)).ok, false);
  assert.equal((await rateLimit("new-key", 1, 60_000)).ok, false);
});
