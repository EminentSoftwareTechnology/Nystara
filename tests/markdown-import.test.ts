import assert from "node:assert/strict";
import { test } from "node:test";
import { articleContent } from "../lib/article-schema";
import { markdownDocument } from "../lib/markdown-import";
import { documentText } from "../lib/story-document";

test("imported Markdown becomes valid story formatting", () => {
  const doc = markdownDocument(
    "# Why indexes matter\n\nIndexes make reads **fast** and *cheap*.\nSee [docs](https://example.com) or `EXPLAIN`.\n\n- Measure\n- Add one\n\n1. First\n2. Second\n\n> Quote line\n\n```\nselect 1;\n```\n\n---\n#### Deep",
  );
  assert.equal(articleContent.safeParse(doc).success, true);
  assert.deepEqual(
    doc.content?.map((node) => node.type),
    ["heading", "paragraph", "bulletList", "orderedList", "blockquote", "codeBlock", "horizontalRule", "heading"],
  );
  assert.equal(doc.content?.[7].attrs?.level, 3);
  const marks = doc.content?.[1].content?.flatMap((node) => node.marks?.map((mark) => mark.type) ?? []);
  assert.deepEqual(marks, ["bold", "italic", "link", "code"]);
  assert.match(documentText(doc), /Indexes make reads fast and cheap/);
});

test("unsafe Markdown links keep their text without a link", () => {
  const doc = markdownDocument("[click](javascript:alert(1))");
  assert.equal(articleContent.safeParse(doc).success, true);
  assert.equal(doc.content?.[0].content?.some((node) => node.marks?.length), false);
});
