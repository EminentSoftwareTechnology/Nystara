type Bucket = { count: number; resetAt: number };

// Fixed-window counters held in process memory. Limits apply per instance;
// move this to Redis before running more than one replica.
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 50_000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) evictExpired(now);
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count++;
  return {
    ok: bucket.count <= limit,
    retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

// Bounds memory when an attacker rotates through many keys.
function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size >= MAX_KEYS) buckets.clear();
}
