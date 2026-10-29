import { PutObjectCommand } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { r2Client, r2Config } from "../../lib/r2";
import { storyStoragePrefix } from "../../lib/storage-url";
import { coverSvg, diagramSvg, type Draft } from "./content";

type Storage = ReturnType<typeof r2Config>;

export function newsroomImages(authorId: string, articleId: string, storage: Storage) {
  return storage ? {
    diagram: `${storage.publicUrl}/${storyStoragePrefix(authorId)}${articleId}-v2-diagram.webp`,
    cover: `${storage.publicUrl}/${storyStoragePrefix(authorId)}${articleId}-v2-cover.webp`,
  } : {
    diagram: `/demo/newsroom/${articleId}.webp`,
    cover: `/demo/newsroom/${articleId}-cover.webp`,
  };
}

export async function writeNewsroomImages(authorId: string, articleId: string, draft: Pick<Draft, "diagram">, topic: string, authorIndex: number, storage: Storage) {
  const buffers = await Promise.all([
    sharp(Buffer.from(diagramSvg(draft, topic))).webp().toBuffer(),
    sharp(Buffer.from(coverSvg(authorIndex))).webp().toBuffer(),
  ]);
  if (storage) {
    const client = r2Client(storage);
    try {
      const results = await Promise.allSettled(buffers.map((Body, index) => client.send(new PutObjectCommand({
        Bucket: storage.bucket,
        Key: `${storyStoragePrefix(authorId)}${articleId}-v2-${index === 0 ? "diagram" : "cover"}.webp`,
        Body,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }), { abortSignal: AbortSignal.timeout(30000) })));
      if (results.some((result) => result.status === "rejected")) throw new Error("Newsroom media upload failed; article was not published");
    } finally {
      client.destroy();
    }
  } else {
    const directory = path.join(process.cwd(), "public/demo/newsroom");
    await mkdir(directory, { recursive: true });
    await Promise.all(buffers.map((buffer, index) => writeFile(path.join(directory, `${articleId}${index === 0 ? "" : "-cover"}.webp`), buffer)));
  }
}
