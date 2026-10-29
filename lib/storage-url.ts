export function storyStoragePrefix(userId = "") {
  const prefix = process.env.R2_KEY_PREFIX ?? "";
  if (!/^(?:[a-z0-9][a-z0-9_-]*\/)*$/.test(prefix)) throw new Error("R2_KEY_PREFIX must contain safe directory names ending in /");
  return `${prefix}stories/${userId ? `${userId}/` : ""}`;
}

export function isStorageImage(raw: string): boolean {
  if (process.env.NODE_ENV !== "production" && /^\/demo\/newsroom\/[a-z0-9-]+\.webp$/.test(raw)) return true;
  try {
    const url = new URL(raw);
    const base = new URL(process.env.R2_PUBLIC_URL ?? "");
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.origin === base.origin &&
      url.pathname.startsWith(`${base.pathname.replace(/\/$/, "")}/${storyStoragePrefix()}`) &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function isOwnedProfileImage(raw: string, userId: string): boolean {
  if (raw.startsWith("/") || !isStorageImage(raw)) return false;
  const base = new URL(process.env.R2_PUBLIC_URL!);
  const url = new URL(raw);
  const prefix = `${base.pathname.replace(/\/$/, "")}/${storyStoragePrefix(userId)}`;
  const filename = url.pathname.slice(prefix.length);
  return url.pathname.startsWith(prefix) && /^[a-f0-9-]+\.webp$/.test(filename);
}
