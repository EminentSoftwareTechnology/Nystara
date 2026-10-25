import sharp from "sharp";

export const IMAGE_MAX_EDGE = { inline: 1600, cover: 2400, avatar: 512 } as const;
export type ImagePurpose = keyof typeof IMAGE_MAX_EDGE;

// Rejects decompression bombs before pixels are allocated.
const MAX_INPUT_PIXELS = 40_000_000;

export class InvalidImage extends Error {}

/**
 * Fully decodes the upload, applies EXIF orientation, fits it inside the purpose's bounding box and re-encodes
 * it as WebP. Re-encoding drops metadata (EXIF, GPS, ICC comments) and anything appended to the original file.
 */
export async function toWebp(bytes: Buffer, purpose: ImagePurpose) {
  const image = sharp(bytes, {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: "warning",
    animated: false,
  });
  let format: string | undefined;
  try {
    ({ format } = await image.metadata());
  } catch {
    throw new InvalidImage("Unreadable image");
  }
  if (!format || !["jpeg", "png", "webp"].includes(format)) throw new InvalidImage("Unsupported image format");
  const edge = IMAGE_MAX_EDGE[purpose];
  try {
    return await image
      .autoOrient()
      .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new InvalidImage("Corrupt image");
  }
}
