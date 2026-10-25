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
