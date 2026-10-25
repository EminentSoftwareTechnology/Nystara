const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
export const UPLOAD_MAX_BYTES = 600 * 1024;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_EDGE = 2400;

function encode(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

/**
 * Shrinks large photos in the browser so they fit the upload limit. The server still validates, resizes and
 * re-encodes every upload; this only saves bandwidth and lets people pick photos straight from a camera.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (!ACCEPTED.includes(file.type) || file.size > MAX_SOURCE_BYTES)
    throw new Error("Choose a JPEG, PNG or WebP image up to 25 MB.");
  if (file.size <= UPLOAD_MAX_BYTES) return file;

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    let scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await encode(canvas, 0.85 - attempt * 0.05);
      // Browsers without WebP encoding fall back to PNG, which the server also accepts.
      if (blob && ACCEPTED.includes(blob.type) && blob.size <= UPLOAD_MAX_BYTES) return blob;
      scale *= 0.75;
    }
  } finally {
    bitmap.close();
  }
  throw new Error("This image is too large to upload. Try a smaller one.");
}
