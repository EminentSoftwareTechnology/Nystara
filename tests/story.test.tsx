import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { articleContent, coverImageUrl } from "../lib/article-schema";
import { documentText, dropUnsupportedTextStyles, legacyDocument, storyNode } from "../lib/story-document";
import { parseVideoUrl, safeVideoThumbnail } from "../lib/video";
import { hasPremiumAccess } from "../lib/premium";
import { responseText } from "../lib/ai-editor";
import { imageType } from "../lib/image-type";
import StoryContent from "../components/article/StoryContent";

test("formatted documents preserve readable text and safely render semantic formatting", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "A title" }],
      },
      {
        type: "paragraph",
        attrs: { textAlign: "center" },
        content: [
          {
            type: "text",
            text: '<script>alert("xss")</script>',
            marks: [
              { type: "bold" },
              {
                type: "textStyle",
                attrs: { fontFamily: "Georgia", fontSize: "24px" },
              },
            ],
          },
        ],
      },
    ],
  };
  const parsed = storyNode.parse(doc);
  assert.equal(articleContent.safeParse(doc).success, true);
  assert.equal(documentText(parsed), 'A title\n<script>alert("xss")</script>');
  const html = renderToStaticMarkup(
    <StoryContent content={doc} text="fallback" />,
  );
  assert.match(html, /<h2>/);
  assert.match(html, /<strong>/);
  assert.match(html, /font-family:Georgia/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("legacy content remains readable and rich content rejects active links, styles and frames", () => {
  assert.equal(documentText(legacyDocument("One\n\nTwo")), "One\nTwo");
  assert.match(
    renderToStaticMarkup(
      <StoryContent content={{ text: "old" }} text="Legacy story" />,
    ),
    /Legacy story/,
  );
  for (const node of [
    { type: "iframe", attrs: { src: "https://evil.test" } },
    {
      type: "text",
      text: "click",
      marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
    },
    {
      type: "text",
      text: "hidden",
      marks: [
        { type: "textStyle", attrs: { fontFamily: "url(https://evil.test)" } },
      ],
    },
    { type: "image", attrs: { src: "https://evil.test/pixel" } },
    {
      type: "video",
      attrs: { url: "https://youtube.com.evil.test/watch?v=M7lc1UVf-VE" },
    },
    {
      type: "video",
      attrs: {
        url: "https://youtu.be/M7lc1UVf-VE",
        thumbnail: "https://evil.test/pixel",
      },
    },
  ])
    assert.equal(
      articleContent.safeParse({ type: "doc", content: [node] }).success,
      false,
    );
});

test("R2 media is limited to the configured public base and story prefix", () => {
  process.env.R2_PUBLIC_URL = "https://media.example.test/assets";
  assert.equal(
    coverImageUrl.safeParse(
      "https://media.example.test/assets/stories/user/a.png",
    ).success,
    true,
  );
  assert.equal(
    articleContent.safeParse({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "https://media.example.test/assets/stories/user/a.png",
          },
        },
      ],
    }).success,
    true,
  );
  for (const url of [
    "https://media.example.test/elsewhere/a.png",
    "https://media.example.test.evil.test/assets/stories/a.png",
    "https://user@media.example.test/assets/stories/a.png",
  ])
    assert.equal(coverImageUrl.safeParse(url).success, false);
  delete process.env.R2_PUBLIC_URL;
});

test("video URLs reject credentials, arbitrary hosts, non-HTTPS, invalid IDs and redirect paths", () => {
  for (const url of [
    "https://youtu.be/M7lc1UVf-VE",
    "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    "https://youtube.com/shorts/M7lc1UVf-VE",
  ])
    assert.equal(parseVideoUrl(url)?.id, "M7lc1UVf-VE");
  assert.equal(parseVideoUrl("https://vimeo.com/123456")?.provider, "vimeo");
  for (const url of [
    "http://youtube.com/watch?v=M7lc1UVf-VE",
    "https://youtu.be/invalid",
    "https://user@youtu.be/M7lc1UVf-VE",
    "https://youtube.com/redirect?v=M7lc1UVf-VE",
    "https://127.0.0.1/video",
    "https://vimeo.com.evil.test/123",
  ])
    assert.equal(parseVideoUrl(url), null);
  assert.equal(
    safeVideoThumbnail("https://i.vimeocdn.com/video/123.jpg"),
    true,
  );
  assert.equal(
    safeVideoThumbnail("https://i.ytimg.com.evil.test/a.jpg"),
    false,
  );
});

test("premium editing excludes canceled, past-due and expired subscriptions", () => {
  const future = new Date(Date.now() + 86400000);
  for (const status of ["ACTIVE", "TRIALING"])
    assert.equal(hasPremiumAccess({ status, currentPeriodEnd: future }), true);
  for (const status of ["CANCELED", "PAST_DUE"])
    assert.equal(hasPremiumAccess({ status, currentPeriodEnd: future }), false);
  assert.equal(
    hasPremiumAccess({ status: "ACTIVE", currentPeriodEnd: new Date(0) }),
    false,
  );
  assert.equal(hasPremiumAccess(null), false);
});

test("AI output consumes only text message parts; invalid uploads cannot masquerade as images", () => {
  assert.equal(
    responseText({
      output: [
        {
          type: "reasoning",
          content: [{ type: "output_text", text: "private" }],
        },
        {
          type: "message",
          content: [{ type: "output_text", text: "Suggestion" }],
        },
      ],
    }),
    "Suggestion",
  );
  assert.equal(
    responseText({
      output: [
        { type: "message", content: [{ type: "refusal", refusal: "No" }] },
      ],
    }),
    "",
  );
  assert.equal(imageType(Buffer.from('<svg onload="alert(1)">')), null);
  assert.equal(
    imageType(Buffer.from([255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
    "image/jpeg",
  );
});

test("text pasted with unsupported fonts still saves", () => {
  const pasted = {
    type: "doc",
    content: [{
      type: "paragraph",
      content: [
        { type: "text", text: "Pasted", marks: [{ type: "textStyle", attrs: { fontFamily: "Google Sans Text, sans-serif !important", fontSize: "13px", lineHeight: "1.8" } }] },
        { type: "text", text: " kept", marks: [{ type: "textStyle", attrs: { fontFamily: "Georgia" } }] },
      ],
    }],
  };
  assert.equal(articleContent.safeParse(pasted).success, false);
  const cleaned = dropUnsupportedTextStyles(pasted);
  assert.equal(articleContent.safeParse(cleaned).success, true);
  assert.deepEqual(cleaned.content[0].content[0].marks[0].attrs, { fontFamily: null, fontSize: null, lineHeight: "1.8" });
  assert.deepEqual(cleaned.content[0].content[1].marks[0].attrs, { fontFamily: "Georgia" });
});
