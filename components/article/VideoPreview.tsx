"use client";

import { useState } from "react";
import { parseVideoUrl, safeVideoThumbnail } from "@/lib/video";

export default function VideoPreview({
  url,
  title,
  thumbnail,
}: {
  url: string;
  title?: string | null;
  thumbnail?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const video = parseVideoUrl(url);
  if (!video) return null;
  const src =
    video.provider === "youtube"
      ? `https://www.youtube.com/embed/${video.id}`
      : `https://player.vimeo.com/video/${video.id}`;
  return (
    <figure
      className="my-6 overflow-hidden rounded-xl border border-border bg-background"
      contentEditable={false}
    >
      {playing ? (
        <iframe
          src={src}
          title={title ?? "Embedded video"}
          className="aspect-video min-h-[200px] w-full"
          allow="fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="relative block aspect-video w-full bg-surface text-foreground"
          aria-label={`Play ${title ?? "video"}`}
        >
          {thumbnail && safeVideoThumbnail(thumbnail) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/15">
            <span className="rounded-full bg-black/80 px-6 py-4 text-xl text-white">
              ▶<span className="sr-only">Play video</span>
            </span>
          </span>
        </button>
      )}
      <figcaption className="flex flex-wrap items-center justify-between gap-2 p-3 font-sans text-sm">
        <span>{title ?? "Video"}</span>
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Watch on {video.provider === "youtube" ? "YouTube" : "Vimeo"}
        </a>
      </figcaption>
    </figure>
  );
}
