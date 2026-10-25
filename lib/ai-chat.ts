import { z } from "zod";

export const AI_ATTACHMENT_BYTES = 500_000;
const MIME_TYPES = ["text/plain", "text/markdown", "text/csv", "application/json", "application/pdf", "image/png", "image/jpeg"] as const;
export const aiAttachmentSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(MIME_TYPES),
  data: z.string().max(670_000).regex(/^[A-Za-z0-9+/]*={0,2}$/),
}).refine((file) => Buffer.byteLength(file.data, "base64") <= AI_ATTACHMENT_BYTES, "File is too large.");

export const aiChatSchema = z.object({
  conversationId: z.string().min(1).max(100).optional(),
  text: z.string().trim().min(1).max(12000),
  attachments: z.array(aiAttachmentSchema).max(3).default([]),
}).refine((value) => value.attachments.reduce((size, file) => size + Buffer.byteLength(file.data, "base64"), 0) <= AI_ATTACHMENT_BYTES, "Attachments must total 500 KB or less.");

export type AiAttachment = z.infer<typeof aiAttachmentSchema>;
export type ChatMessage = { id: string; role: string; content: string; attachments: { name: string; type: string }[]; createdAt: string };
export type ChatConversation = { id: string; title: string; updatedAt: string };

export function attachmentInputs(files: AiAttachment[]) {
  return files.map((file) => {
    if (file.type.startsWith("image/")) return { type: "input_image", image_url: `data:${file.type};base64,${file.data}` };
    if (file.type === "application/pdf") return { type: "input_file", filename: file.name, file_data: `data:${file.type};base64,${file.data}` };
    return { type: "input_text", text: `Attached document: ${file.name}\n${Buffer.from(file.data, "base64").toString("utf8")}` };
  });
}

export function chatHistoryInputs(messages: { role: string; content: string; attachments: unknown }[]) {
  let attachmentBytes = 0;
  let textChars = 0;
  const history = [];
  for (const message of messages.slice(0, 12)) {
    if (textChars + message.content.length > 60_000) break;
    textChars += message.content.length;
    const files = (z.array(aiAttachmentSchema).safeParse(message.attachments).data ?? []).filter((file) => {
      const bytes = Buffer.byteLength(file.data, "base64");
      if (attachmentBytes + bytes > AI_ATTACHMENT_BYTES) return false;
      attachmentBytes += bytes;
      return true;
    });
    history.push({ role: message.role, content: [{ type: message.role === "assistant" ? "output_text" : "input_text", text: message.content }, ...attachmentInputs(files)] });
  }
  return history.reverse();
}
