export const MAX_CONTENT_CHARS = 100_000;
export const MAX_BODY_BYTES = 1024 * 1024;

export class PayloadTooLarge extends Error {}
export class BodyReadTimeout extends Error {}

export async function readBody(req: Request): Promise<string> {
  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) {
    throw new PayloadTooLarge();
  }
  if (!req.body) return "";
  const reader = req.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new BodyReadTimeout());
      void reader.cancel().catch(() => undefined);
    }, 10_000);
  });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new PayloadTooLarge();
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, size).toString("utf8");
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return JSON.parse(await readBody(req)) as unknown;
  } catch {
    return null;
  }
}

export function parsePage(raw: string | null | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) return 1;
  return Math.min(1000, Math.max(1, Number(raw)));
}

export function isSameOriginWrite(req: Request): boolean {
  const origin = req.headers.get("origin");
  const configured = process.env.NEXTAUTH_URL;
  if (!origin || !configured) return false;
  try {
    return new URL(origin).origin === new URL(configured).origin &&
      req.headers.get("sec-fetch-site") !== "cross-site";
  } catch {
    return false;
  }
}
