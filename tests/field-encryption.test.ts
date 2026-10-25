import assert from "node:assert/strict";
import { test } from "node:test";

import { blindIndex, decryptField, encryptField, isEncrypted } from "../lib/field-encryption";
import { decryptResult, encryptData, rewriteWhere } from "../lib/prisma-encryption";

// Keys are derived on first use, so setting the variable here is early enough.
process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

test("fields round-trip and use a fresh IV each time", () => {
  const a = encryptField("reader@example.com");
  const b = encryptField("reader@example.com");
  assert.ok(isEncrypted(a));
  assert.notEqual(a, b);
  assert.equal(decryptField(a), "reader@example.com");
  assert.equal(decryptField("legacy plaintext"), "legacy plaintext");
});

test("tampered ciphertext is rejected", () => {
  const value = encryptField("secret note");
  const tampered = value.slice(0, -2) + (value.endsWith("A") ? "BB" : "AA");
  assert.throws(() => decryptField(tampered));
});

test("blind index ignores case and surrounding spaces", () => {
  assert.equal(blindIndex(" Reader@Example.COM "), blindIndex("reader@example.com"));
  assert.notEqual(blindIndex("a@example.com"), blindIndex("b@example.com"));
});

test("writes encrypt nested personal data and set the email hash", () => {
  const data: Record<string, unknown> = {
    email: "Reader@Example.com",
    name: "Reader",
    aiConversations: { create: { title: "My chat", messages: { create: [{ role: "user", content: "hello" }] } } },
  };
  encryptData("User", data);
  assert.ok(isEncrypted(data.email as string));
  assert.equal(data.emailHash, blindIndex("reader@example.com"));
  assert.equal(data.name, "Reader");
  const chat = (data.aiConversations as { create: { title: string; messages: { create: { content: string }[] } } }).create;
  assert.ok(isEncrypted(chat.title));
  assert.ok(isEncrypted(chat.messages.create[0].content));
  const again = { ...data };
  encryptData("User", again);
  assert.equal(again.emailHash, data.emailHash, "already-encrypted values are not hashed again");
});

test("email lookups become blind-index lookups; other filters on ciphertext fail loudly", () => {
  const where: Record<string, unknown> = { OR: [{ email: { equals: "A@B.com", mode: "insensitive" } }, { name: { contains: "a" } }] };
  rewriteWhere("User", where);
  assert.deepEqual(where, { OR: [{ emailHash: blindIndex("a@b.com") }, { name: { contains: "a" } }] });
  const nested: Record<string, unknown> = { author: { is: { email: "x@y.com" } } };
  rewriteWhere("Article", nested);
  assert.deepEqual(nested, { author: { is: { emailHash: blindIndex("x@y.com") } } });
  assert.throws(() => rewriteWhere("User", { email: { contains: "example" } }));
  assert.throws(() => rewriteWhere("AiConversation", { title: "x" }));
});

test("reads decrypt only encrypted columns, including through relations", () => {
  const lookalike = "enc:v1:not-really";
  const rows = [{ body: lookalike, guestName: encryptField("Maya"), article: { title: lookalike, author: { email: encryptField("w@x.com") } } }];
  decryptResult("Comment", rows);
  assert.deepEqual(rows, [{ body: lookalike, guestName: "Maya", article: { title: lookalike, author: { email: "w@x.com" } } }]);
});
