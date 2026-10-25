import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { readJson } from "@/lib/request";
import { parseVideoUrl, safeVideoThumbnail, videoUrl } from "@/lib/video";

const metadata = z.object({
  title: z.string().max(500),
  thumbnail_url: z.string().refine(safeVideoThumbnail),
});

export async function POST(req: Request) {
  if (!(await auth())?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = z.object({ url: videoUrl }).safeParse(await readJson(req));
  if (!input.success)
    return NextResponse.json(
      { error: "Use a public YouTube or Vimeo video URL." },
      { status: 400 },
    );
  const video = parseVideoUrl(input.data.url)!;
  const endpoint =
    video.provider === "youtube"
      ? "https://www.youtube.com/oembed"
      : "https://vimeo.com/api/oembed.json";
  try {
    const response = await fetch(
      `${endpoint}?url=${encodeURIComponent(video.url)}&format=json`,
      { redirect: "error", signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok)
      return NextResponse.json(
        { error: "This video is private, unavailable or cannot be embedded." },
        { status: 422 },
      );
    const result = metadata.safeParse(await response.json());
    if (!result.success)
      return NextResponse.json(
        { error: "A safe video thumbnail could not be loaded." },
        { status: 422 },
      );
    return NextResponse.json({
      url: video.url,
      title: result.data.title,
      thumbnail: result.data.thumbnail_url,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not load the video preview. Please retry." },
      { status: 502 },
    );
  }
}
