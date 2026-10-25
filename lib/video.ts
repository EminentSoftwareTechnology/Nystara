import { z } from "zod";

export function parseVideoUrl(
  raw: string,
): { provider: "youtube" | "vimeo" | "file"; id: string; url: string; hash?: string } | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    const host = url.hostname.replace(/^www\./, "");
    if (["youtube.com", "m.youtube.com", "youtube-nocookie.com", "youtu.be"].includes(host)) {
      const id =
        host === "youtu.be"
          ? url.pathname.slice(1)
          : url.pathname === "/watch"
            ? url.searchParams.get("v")
            : /^\/(?:shorts|embed)\/([^/]+)$/.exec(url.pathname)?.[1];
      if (id && /^[\w-]{11}$/.test(id))
        return {
          provider: "youtube",
          id,
          url: `https://www.youtube.com/watch?v=${id}`,
        };
    }
    if (["vimeo.com", "player.vimeo.com"].includes(host)) {
      const match = /^\/(?:video\/)?([0-9]{1,12})(?:\/([a-f0-9]{10}))?\/?$/.exec(url.pathname);
      const hash = match?.[2] ?? url.searchParams.get("h") ?? undefined;
      if (match && (!hash || /^[a-f0-9]{10}$/.test(hash))) return {
        provider: "vimeo",
        id: match[1],
        url: `https://vimeo.com/${match[1]}${hash ? `/${hash}` : ""}`,
        ...(hash ? { hash } : {}),
      };
    }
    if (/\.(?:mp4|webm|ogv)$/i.test(url.pathname)) {
      return { provider: "file", id: "", url: url.href };
    }
  } catch {
    return null;
  }
  return null;
}

export const videoUrl = z
  .string()
  .max(2048)
  .refine(
    (value) => parseVideoUrl(value) !== null,
    "Use a public YouTube, Vimeo, MP4, WebM or OGV video URL",
  );

export function safeVideoThumbnail(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      ["i.ytimg.com", "i.vimeocdn.com"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
