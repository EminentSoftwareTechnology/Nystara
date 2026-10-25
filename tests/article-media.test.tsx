import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import StoryContent from "../components/article/StoryContent";
import VideoPreview from "../components/article/VideoPreview";
import ImagePicker from "../components/media/ImagePicker";
import { parseVideoUrl } from "../lib/video";
import { isOwnedProfileImage } from "../lib/storage-url";
import { toWebp } from "../lib/image-pipeline";
import { contentSecurityPolicy } from "../lib/csp";

const youtube = "https://www.youtube.com/watch?v=M7lc1UVf-VE";
const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

test("published rich-text and legacy standalone links become video cards without republishing", () => {
  for (const content of [
    { type: "doc", content: [paragraph(youtube)] },
    { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Watch this talk", marks: [{ type: "link", attrs: { href: youtube } }] }] }] },
    { text: youtube },
  ]) {
    const html = renderToStaticMarkup(<StoryContent content={content} text={youtube} />);
    assert.match(html, /<figure/);
    assert.match(html, /aria-label="Play /);
    assert.match(html, /Watch on YouTube/);
    assert.doesNotMatch(html, /<iframe/);
  }
  const multiline = renderToStaticMarkup(<StoryContent content={{ text: "legacy" }} text={`Before\n${youtube}\nAfter`} />);
  assert.match(multiline, /<p[^>]*>.*Before/);
  assert.match(multiline, /<figure/);
  assert.match(multiline, /After/);
});

test("prose, code blocks and unsupported external links retain their text", () => {
  for (const node of [{ type: "paragraph", content: [{ type: "text", text: youtube, marks: [{ type: "code" }] }] }, paragraph(`Here is a video: ${youtube}`), { type: "codeBlock", content: [{ type: "text", text: youtube }] }, paragraph("https://example.test/an-article")]) {
    const html = renderToStaticMarkup(<StoryContent content={{ type: "doc", content: [node] }} text="" />);
    assert.doesNotMatch(html, /<figure/);
    assert.match(html, /https:/);
  }
});

test("provider embed links and HTTPS direct video files parse while unsafe variants are rejected", () => {
  assert.equal(parseVideoUrl("https://www.youtube-nocookie.com/embed/M7lc1UVf-VE")?.provider, "youtube");
  assert.equal(parseVideoUrl("https://player.vimeo.com/video/123456")?.id, "123456");
  assert.equal(parseVideoUrl("https://player.vimeo.com/video/76979871?h=8272103f6e")?.hash, "8272103f6e");
  assert.equal(parseVideoUrl("https://vimeo.com/76979871/8272103f6e")?.hash, "8272103f6e");
  assert.equal(parseVideoUrl("https://player.vimeo.com/video/76979871?h=invalid"), null);
  for (const suffix of ["mp4", "webm", "ogv"]) assert.equal(parseVideoUrl(`https://media.example.test/movie.${suffix}?version=2`)?.provider, "file");
  for (const url of ["http://media.example.test/a.mp4", "javascript:a.mp4", "https://user:secret@media.example.test/a.mp4", "https://media.example.test:8443/a.mp4", "https://media.example.test/a.mp4/evil", "https://youtube.com.evil.test/watch?v=M7lc1UVf-VE"]) assert.equal(parseVideoUrl(url), null);
});

test("direct files use native controls and embedded video previews retain a fallback link", () => {
  const html = renderToStaticMarkup(<VideoPreview url="https://media.example.test/a.webm" />);
  assert.match(html, /<video/);
  assert.match(html, /controls=""/);
  assert.match(html, /preload="metadata"/);
  assert.match(html, /playsInline=""/);
  assert.match(html, /Open video/);
  const card = renderToStaticMarkup(<VideoPreview url={youtube} thumbnail="https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg" />);
  assert.match(card, /<img/);
  assert.doesNotMatch(card, /<iframe/);
  assert.match(contentSecurityPolicy("test"), /frame-src[^;]*https:\/\/www.youtube-nocookie.com/);
  assert.match(contentSecurityPolicy("test"), /media-src 'self' https:/);
});

test("profile photo updates accept only the caller's generated R2 image paths", () => {
  process.env.R2_PUBLIC_URL = "https://media.example.test/assets";
  try {
    assert.equal(isOwnedProfileImage("https://media.example.test/assets/stories/owner/1234-abcd.webp", "owner"), true);
    for (const url of ["https://media.example.test/assets/stories/other/1234-abcd.webp", "https://media.example.test/assets/stories/owner-evil/1234-abcd.webp", "https://evil.test/stories/owner/1234-abcd.webp", "https://media.example.test/assets/stories/owner/../other/1234-abcd.webp", "https://media.example.test/assets/stories/owner/1234-abcd.webp?tracking=1", "data:image/png;base64,a"]) assert.equal(isOwnedProfileImage(url, "owner"), false);
  } finally { delete process.env.R2_PUBLIC_URL; }
});

test("avatar processing limits pixel dimensions and strips original metadata", async () => {
  const source = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: "#14224a" } }).jpeg().withMetadata().toBuffer();
  const { data, info } = await toWebp(source, "avatar");
  assert.equal(info.width, 512);
  assert.ok(info.height <= 512);
  const metadata = await sharp(data).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.exif, undefined);
});

test("photo and banner pickers expose upload, replace and removal controls", () => {
  for (const purpose of ["avatar", "cover"] as const) {
    const empty = renderToStaticMarkup(<ImagePicker purpose={purpose} value={null} onChange={() => undefined} onUploading={() => undefined} />);
    const existing = renderToStaticMarkup(<ImagePicker purpose={purpose} value="/test.webp" onChange={() => undefined} onUploading={() => undefined} />);
    assert.match(empty, /Upload /);
    assert.match(existing, /Replace /);
    assert.match(existing, /Remove /);
    assert.match(empty, /accept="image\/jpeg,image\/png,image\/webp"/);
  }
});
