// The left-most X-Forwarded-For entry is client-controlled; the right-most is
// the address our edge proxy (Railway) actually observed.
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",").at(-1)!.trim();
  return "unknown";
}
