import { createTransport } from "nodemailer";
import { Resend } from "resend";
import type { EmailEvent, EmailOptions } from "./templates";
import { renderEmail } from "./templates";
import { usesResend } from "./provider";
import { prisma } from "../prisma";

export type RenderedEmail = { subject: string; html: string; text: string };

export async function deliverEmail(to: string, message: RenderedEmail, unsubscribeUrl?: string) {
  const recipient = await prisma.user.findUnique({ where: { email: to }, select: { isSynthetic: true } });
  if (recipient?.isSynthetic) throw new Error("Synthetic accounts cannot receive email");
  const from = process.env.EMAIL_FROM ?? (usesResend() ? "Nystara <noreply@nystara.com>" : "Nystara <noreply@nystara.local>");
  const headers = unsubscribeUrl ? {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  } : undefined;
  if (usesResend()) {
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({ from, to, ...message, headers });
    if (result.error) throw new Error(`Email delivery failed: ${result.error.name}`);
    return result.data.id;
  } else {
    const transport = createTransport(process.env.EMAIL_SERVER ?? "smtp://127.0.0.1:1035");
    try {
      const result = await transport.sendMail({ from, to, ...message, headers });
      return result.messageId;
    } finally {
      transport.close();
    }
  }
}

export async function sendEmail(to: string, event: EmailEvent, options: EmailOptions = {}) {
  return deliverEmail(to, await renderEmail(event, options), options.unsubscribeUrl);
}
