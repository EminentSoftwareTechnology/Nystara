import { prepareImage } from "./prepare-image";

export async function uploadImage(file: File, purpose: "inline" | "cover" | "avatar"): Promise<string> {
  const image = await prepareImage(file);
  const bytes = new Uint8Array(await image.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const response = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: image.type, data: btoa(binary), purpose }),
  });
  const result: { url?: string; error?: string } = await response.json();
  if (!response.ok || !result.url) throw new Error(result.error ?? "Upload failed. Please retry.");
  return result.url;
}
