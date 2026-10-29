import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getVerifiedAdminSession } from "@/lib/admin-auth";
import { auth } from "@/lib/auth";
import { readJson } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { imageType } from "@/lib/image-type";
import { r2Config, r2Client } from "@/lib/r2";
import { storyStoragePrefix } from "@/lib/storage-url";
import { clamavConfig, clamavScan } from "@/lib/clamav";
import { InvalidImage, toWebp } from "@/lib/image-pipeline";

const schema = z.object({
  data: z.string().max(820000),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  purpose: z.enum(["inline", "cover", "avatar"]).default("inline"),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id ?? (await getVerifiedAdminSession())?.sub;
  if (!userId)
    return NextResponse.json(
      { error: "Sign in to upload images." },
      { status: 401 },
    );
  const config = r2Config();
  if (!config) {
    return NextResponse.json(
      { error: "Image storage is not configured yet." },
      { status: 503 },
    );
  }
  const quota = await rateLimit(`media:${userId}`, 50, 86400_000);
  if (!quota.ok)
    return NextResponse.json(
      { error: "Daily image upload limit reached." },
      { status: 429 },
    );
  const input = schema.safeParse(await readJson(req));
  if (!input.success || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.data.data))
    return NextResponse.json(
      { error: "Upload a JPEG, PNG or WebP image up to 600 KB." },
      { status: 400 },
    );
  const bytes = Buffer.from(input.data.data, "base64");
  if (bytes.length > 600 * 1024 || imageType(bytes) !== input.data.type)
    return NextResponse.json(
      { error: "Invalid image or file larger than 600 KB." },
      { status: 400 },
    );
  const scanner = clamavConfig();
  if (scanner) {
    try {
      if (await clamavScan(bytes, scanner))
        return NextResponse.json(
          { error: "This file was blocked by the virus scanner." },
          { status: 422 },
        );
    } catch {
      return NextResponse.json(
        { error: "Uploads are paused while the file scanner is unavailable." },
        { status: 503 },
      );
    }
  }
  let webp: Buffer;
  try {
    ({ data: webp } = await toWebp(bytes, input.data.purpose));
  } catch (error) {
    if (!(error instanceof InvalidImage)) throw error;
    return NextResponse.json(
      { error: "This image could not be read. Try another file." },
      { status: 400 },
    );
  }
  const key = `${storyStoragePrefix(userId)}${randomUUID()}.webp`;
  const client = r2Client(config);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: webp,
        ContentType: "image/webp",
        // Keys are random and never overwritten.
        CacheControl: "public, max-age=31536000, immutable",
      }),
      { abortSignal: AbortSignal.timeout(20_000) },
    );
    return NextResponse.json(
      { url: `${config.publicUrl}/${key}` },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Image upload failed. Please retry." },
      { status: 502 },
    );
  } finally {
    client.destroy();
  }
}
