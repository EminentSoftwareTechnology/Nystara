import assert from "node:assert/strict";
import test from "node:test";
import { aiChatSchema, attachmentInputs } from "../lib/ai-chat";

const textFile = (value: string) => ({ name: "draft.md", type: "text/markdown" as const, data: Buffer.from(value).toString("base64") });

test("chat validates aggregate attachment size and supported files", () => {
  assert.equal(aiChatSchema.safeParse({ text: "Edit this", attachments: [textFile("hello")] }).success, true);
  const file = textFile("x".repeat(260_000));
  assert.equal(aiChatSchema.safeParse({ text: "Edit this", attachments: [file, file] }).success, false);
  assert.equal(aiChatSchema.safeParse({ text: "Edit this", attachments: [{ name: "unsafe.exe", type: "application/octet-stream", data: "aGVsbG8=" }] }).success, false);
  assert.equal(aiChatSchema.safeParse({ text: " ", attachments: [] }).success, false);
  assert.equal(aiChatSchema.safeParse({ text: "x", attachments: Array(4).fill(textFile("small")) }).success, false);
  assert.equal(aiChatSchema.safeParse({ text: "x", attachments: [{ ...textFile("small"), data: "not base64!" }] }).success, false);
});

test("text files are decoded as source text while PDFs and images use typed API inputs", () => {
  assert.deepEqual(attachmentInputs([textFile("My draft")]), [{ type: "input_text", text: "Attached document: draft.md\nMy draft" }]);
  assert.deepEqual(attachmentInputs([{ name: "draft.pdf", type: "application/pdf", data: "cGRm" }]), [{ type: "input_file", filename: "draft.pdf", file_data: "data:application/pdf;base64,cGRm" }]);
  assert.deepEqual(attachmentInputs([{ name: "photo.png", type: "image/png", data: "aW1hZ2U=" }]), [{ type: "input_image", image_url: "data:image/png;base64,aW1hZ2U=" }]);
});

test("history preserves recent context within the attachment and text budgets", async () => {
  const { chatHistoryInputs } = await import("../lib/ai-chat");
  const file = textFile("x".repeat(260_000));
  const history = chatHistoryInputs([
    { role: "user", content: "newest", attachments: [file] },
    { role: "assistant", content: "reply", attachments: [] },
    { role: "user", content: "older", attachments: [file] },
  ]);
  assert.equal(history.length, 3);
  assert.equal(history[0].content.length, 1);
  assert.equal(history[2].content.length, 2);
  const large = chatHistoryInputs(Array.from({ length: 12 }, () => ({ role: "user", content: "x".repeat(12_000), attachments: [] })));
  assert.equal(large.length, 5);
});
