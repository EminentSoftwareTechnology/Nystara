"use client";

import { useEffect, useState } from "react";
import { parseVideoUrl, safeVideoThumbnail } from "@/lib/video";

export default function VideoPreview({ url, title, thumbnail }: { url: string; title?: string | null; thumbnail?: string }) {
  const [playingUrl, setPlayingUrl] = useState("");
  const [metadata, setMetadata] = useState<{ url: string; title?: string; thumbnail?: string } | null>(null);
  const [failedImage, setFailedImage] = useState("");
  const video = parseVideoUrl(url);
  const provider = video?.provider;
  const savedThumbnail = thumbnail && safeVideoThumbnail(thumbnail) ? thumbnail : undefined;
  useEffect(() => {
    if (!provider || provider === "file" || savedThumbnail) return;
    const controller = new AbortController();
    fetch(`/api/videos?url=${encodeURIComponent(url)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data: { title?: string; thumbnail?: string } = await response.json();
        if (!controller.signal.aborted) setMetadata({ ...data, url });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [url, provider, savedThumbnail]);
  if (!video) return null;
  const loaded = metadata?.url === url ? metadata : null;
  const caption = title && title !== "Video" ? title : loaded?.title ?? (provider === "youtube" ? "YouTube video" : provider === "vimeo" ? "Vimeo video" : "Video");
  const poster = savedThumbnail ?? (loaded?.thumbnail && safeVideoThumbnail(loaded.thumbnail) ? loaded.thumbnail : undefined);
  const providerName = provider === "youtube" ? "YouTube" : "Vimeo";
  const src = provider === "youtube" ? `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1` : `https://player.vimeo.com/video/${video.id}?autoplay=1${video.hash ? `&h=${video.hash}` : ""}`;
  return <figure className="my-6 overflow-hidden rounded-xl border border-border bg-background" contentEditable={false}>
    {provider === "file" ? (
      <video src={video.url} controls playsInline preload="metadata" aria-label={caption} className="aspect-video w-full bg-black">
        <a href={video.url}>Open video</a>
      </video>
    ) : playingUrl === url ? (
      <iframe src={src} title={caption} className="aspect-video min-h-[200px] w-full" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    ) : (
      <button type="button" onClick={() => setPlayingUrl(url)} className="relative block aspect-video w-full bg-surface text-foreground" aria-label={`Play ${caption}`}>
        {poster && poster !== failedImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedImage(poster)} className="h-full w-full object-cover" />
        )}
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/15">
          <span className="rounded-full bg-black/80 px-6 py-4 text-xl text-white" aria-hidden="true">▶</span>
          {(!poster || poster === failedImage) && <span className="rounded-full bg-black/80 px-3 py-1 text-sm text-white">Watch on {providerName}</span>}
        </span>
      </button>
    )}
    <figcaption className="flex flex-wrap items-center justify-between gap-2 p-3 font-sans text-sm">
      <span>{caption}</span>
      <a href={video.url} target="_blank" rel="noopener noreferrer" className="underline">{provider === "file" ? "Open video" : `Watch on ${providerName}`}</a>
    </figcaption>
  </figure>;
}
