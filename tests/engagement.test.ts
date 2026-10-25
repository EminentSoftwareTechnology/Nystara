import assert from "node:assert/strict";
import { connect } from "node:net";
import { test } from "node:test";
import sharp from "sharp";
import { InvalidImage, toWebp } from "../lib/image-pipeline";
import { clamavScan } from "../lib/clamav";
import { commentInput, toCommentView } from "../lib/comments";
import { storyTheme, toStoryTheme } from "../lib/story-theme";

const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#3a6" } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "secret-owner" } })
    .toBuffer();

test("uploads are resized inside the purpose bounding box and re-encoded as WebP", async () => {
  const input = await photo(3200, 1800);
  const inline = await toWebp(input, "inline");
  assert.equal(inline.info.format, "webp");
  assert.equal(inline.info.width, 1600);
  assert.equal(inline.info.height, 900);
  const cover = await toWebp(input, "cover");
  assert.equal(cover.info.width, 2400);
});

test("small images are not enlarged and metadata is stripped", async () => {
  const input = await photo(400, 300);
  assert.match(input.toString("latin1"), /secret-owner/);
  const { data, info } = await toWebp(input, "inline");
  assert.equal(info.width, 400);
  assert.doesNotMatch(data.toString("latin1"), /secret-owner/);
  assert.equal((await sharp(data).metadata()).exif, undefined);
});

test("corrupt, truncated and unsupported images are rejected", async () => {
  const jpeg = await photo(800, 600);
  await assert.rejects(toWebp(Buffer.from("not an image"), "inline"), InvalidImage);
  await assert.rejects(toWebp(jpeg.subarray(0, jpeg.length / 2), "inline"), InvalidImage);
  const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).gif().toBuffer();
  await assert.rejects(toWebp(gif, "inline"), InvalidImage);
});

const clamd = { host: process.env.CLAMAV_HOST ?? "127.0.0.1", port: Number(process.env.CLAMAV_PORT ?? 3310) };
function clamdReachable() {
  return new Promise<boolean>((resolve) => {
    const socket = connect(clamd, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

test("ClamAV flags the EICAR test file and passes clean images", async (t) => {
  if (!(await clamdReachable())) return t.skip("clamd not reachable");
  const eicar = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
  assert.match((await clamavScan(eicar, clamd)) ?? "", /Eicar/i);
  assert.equal(await clamavScan(await photo(200, 200), clamd), null);
});

test("guest comment names are validated and trimmed", () => {
  assert.equal(commentInput.parse({ body: " Nice ", guestName: " José O'Neil " }).guestName, "José O'Neil");
  assert.equal(commentInput.parse({ body: " Nice " }).body, "Nice");
  for (const guestName of ["A", "<script>", "http://spam.example", "x".repeat(51)])
    assert.equal(commentInput.safeParse({ body: "hi", guestName }).success, false, guestName);
  assert.equal(commentInput.safeParse({ body: "   " }).success, false);
  assert.equal(commentInput.safeParse({ body: "x".repeat(2001) }).success, false);
});

test("comment views name guests and only let the commenter or story author delete", () => {
  const row = {
    id: "c1",
    body: "Hello",
    createdAt: new Date("2026-10-25T10:00:00Z"),
    guestName: "Maya",
    parentId: null,
    authorId: null,
    author: null,
  };
  const guest = toCommentView(row, { userId: null });
  assert.equal(guest.name, "Maya");
  assert.equal(guest.guest, true);
  assert.equal(guest.canDelete, false);
  assert.equal(toCommentView(row, { userId: "author" }).canDelete, false);
  const member = { ...row, guestName: null, authorId: "u1", author: { name: "Liam", username: "liam", avatarUrl: null } };
  assert.equal(toCommentView(member, { userId: "u1" }).canDelete, true);
  assert.equal(toCommentView(member, { userId: "u2" }).canDelete, false);
});

test("story themes fall back to classic for unknown values", () => {
  assert.equal(toStoryTheme("editorial"), "editorial");
  assert.equal(toStoryTheme("comic-sans"), "classic");
  assert.equal(storyTheme.safeParse("bold").success, true);
  assert.equal(storyTheme.safeParse("<x>").success, false);
});
