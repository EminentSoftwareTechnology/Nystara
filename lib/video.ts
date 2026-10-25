import { z } from "zod";

export function parseVideoUrl(
  raw: string,
): { provider: "youtube" | "vimeo"; id: string; url: string } | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    const host = url.hostname.replace(/^www\./, "");
    if (["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) {
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
    if (host === "vimeo.com" && /^\/[0-9]{1,12}$/.test(url.pathname)) {
      return {
        provider: "vimeo",
        id: url.pathname.slice(1),
        url: `https://vimeo.com${url.pathname}`,
      };
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
    "Use a public YouTube or Vimeo video URL",
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
