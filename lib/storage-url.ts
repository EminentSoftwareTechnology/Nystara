export function isStorageImage(raw: string): boolean {
  try {
    const url = new URL(raw);
    const base = new URL(process.env.R2_PUBLIC_URL ?? "");
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.origin === base.origin &&
      url.pathname.startsWith(`${base.pathname.replace(/\/$/, "")}/stories/`) &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function isOwnedProfileImage(raw: string, userId: string): boolean {
  if (!isStorageImage(raw)) return false;
  const base = new URL(process.env.R2_PUBLIC_URL!);
  const url = new URL(raw);
  const prefix = `${base.pathname.replace(/\/$/, "")}/stories/${userId}/`;
  const filename = url.pathname.slice(prefix.length);
  return url.pathname.startsWith(prefix) && /^[a-f0-9-]+\.webp$/.test(filename);
}
