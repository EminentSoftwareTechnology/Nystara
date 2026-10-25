import { createTransport } from "nodemailer";
import { Resend } from "resend";
import type { EmailEvent, EmailOptions } from "./templates";
import { renderEmail } from "./templates";

export type RenderedEmail = { subject: string; html: string; text: string };

// Production always uses Resend; EMAIL_PROVIDER=resend opts a development server in too.
function usesResend() {
  return process.env.NODE_ENV === "production" || process.env.EMAIL_PROVIDER === "resend";
}

export async function deliverEmail(to: string, message: RenderedEmail, unsubscribeUrl?: string) {
  const from = process.env.EMAIL_FROM ?? (process.env.NODE_ENV === "production" ? "Nystara <noreply@nystara.com>" : "Nystara <noreply@nystara.local>");
  const headers = unsubscribeUrl ? {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  } : undefined;
  if (usesResend()) {
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({ from, to, ...message, headers });
    if (result.error) throw new Error("Email delivery failed");
  } else {
    const transport = createTransport(process.env.EMAIL_SERVER ?? "smtp://127.0.0.1:1035");
    try {
      await transport.sendMail({ from, to, ...message, headers });
    } finally {
      transport.close();
    }
  }
}

export async function sendEmail(to: string, event: EmailEvent, options: EmailOptions = {}) {
  await deliverEmail(to, await renderEmail(event, options), options.unsubscribeUrl);
}
