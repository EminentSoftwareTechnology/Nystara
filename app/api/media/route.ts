import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { readJson } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { imageType } from "@/lib/image-type";
import { r2Config, r2Client } from "@/lib/r2";

const schema = z.object({
  data: z.string().max(820000),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
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
  const quota = await rateLimit(`media:${session.user.id}`, 50, 86400_000);
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
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[input.data.type];
  const key = `stories/${session.user.id}/${randomUUID()}.${extension}`;
  const client = r2Client(config);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: bytes,
        ContentType: input.data.type,
        CacheControl: "public, max-age=3600",
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
