import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { isStorageImage } from "./storage-url";

export function r2Config() {
  const {
    R2_ACCOUNT_ID: account,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
    R2_BUCKET_NAME: bucket,
    R2_PUBLIC_URL: publicUrl,
  } = process.env;
  if (
    !account ||
    !/^[a-f0-9]{32}$/i.test(account) ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucket ||
    !publicUrl ||
    !isStorageImage(`${publicUrl.replace(/\/$/, "")}/stories/test.png`)
  )
    return null;
  return {
    account,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrl: publicUrl.replace(/\/$/, ""),
  };
}

export function r2Client(config: NonNullable<ReturnType<typeof r2Config>>) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.account}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function deleteR2Prefix(
  client: S3Client,
  bucket: string,
  prefix: string,
) {
  let continuation: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuation,
        MaxKeys: 1000,
      }),
      { abortSignal: AbortSignal.timeout(20_000) },
    );
    const objects = (page.Contents ?? []).flatMap((object) =>
      object.Key ? [{ Key: object.Key }] : [],
    );
    if (objects.length) {
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects, Quiet: true },
        }),
        { abortSignal: AbortSignal.timeout(20_000) },
      );
      if (result.Errors?.length) throw new Error("R2 image erasure failed");
    }
    continuation = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (page.IsTruncated && !continuation)
      throw new Error("R2 image listing was incomplete");
  } while (continuation);
}

export async function eraseUserImages(userId: string) {
  if (!process.env.R2_BUCKET_NAME) return;
  const config = r2Config();
  if (!config)
    throw new Error("R2 must be configured before erasing uploaded images");
  const client = r2Client(config);
  try {
    await deleteR2Prefix(client, config.bucket, `stories/${userId}/`);
  } finally {
    client.destroy();
  }
}
