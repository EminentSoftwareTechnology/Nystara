export function imageType(bytes: Buffer): string | null {
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
  )
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}
