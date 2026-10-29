import { createHmac } from "node:crypto";
import { createClient } from "redis";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 50_000;
function makeClient() {
  return createClient({
    url: process.env.REDIS_URL,
    disableOfflineQueue: true,
    socket: { connectTimeout: 1000, reconnectStrategy: false },
  });
}
const state = globalThis as typeof globalThis & {
  rateLimitRedis?: Promise<ReturnType<typeof makeClient>>;
};

async function redisClient() {
  if (!state.rateLimitRedis) {
    const client = makeClient();
    const clear = () => {
      if (state.rateLimitRedis === connection) state.rateLimitRedis = undefined;
    };
    client.on("error", clear);
    client.on("end", clear);
    const connection = client.connect().then(() => client).catch(() => {
      clear();
      throw new Error("Rate limiter unavailable");
    });
    state.rateLimitRedis = connection;
  }
  return state.rateLimitRedis;
}

export async function rateLimit(key: string, limit: number, windowMs: number) {
  if (process.env.REDIS_URL) {
    try {
      const client = await redisClient();
      const secret = process.env.NEXTAUTH_SECRET;
      if (!secret) return { ok: false, retryAfter: 60 };
      const digest = createHmac("sha256", secret).update(key).digest("hex");
      const result = await client.withCommandOptions({ timeout: 1000 }).eval(
        `local n = redis.call('INCR', KEYS[1])
         if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
         return {n, redis.call('PTTL', KEYS[1])}`,
        { keys: [`rate:${digest}`], arguments: [String(windowMs)] },
      ) as [number, number];
      return { ok: result[0] <= limit, retryAfter: Math.max(1, Math.ceil(result[1] / 1000)) };
    } catch {
      if (process.env.NODE_ENV === "production") return { ok: false, retryAfter: 60 };
    }
  } else if (process.env.NODE_ENV === "production") {
    return { ok: false, retryAfter: 60 };
  }

  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) {
      for (const [entry, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(entry);
      }
      if (buckets.size >= MAX_KEYS) return { ok: false, retryAfter: 60 };
    }
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count++;
  return { ok: bucket.count <= limit, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
}
