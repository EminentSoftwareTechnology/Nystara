/** Keeps post-sign-in redirects on this site: a same-origin path, never `//host` or a full URL. */
export function safeNext(raw: string | string[] | undefined, fallback = "/"): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}
