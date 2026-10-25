import { createTransport } from "nodemailer";
import { Resend } from "resend";
import type { EmailEvent, EmailOptions } from "./templates";
import { renderEmail } from "./templates";

export async function sendEmail(to: string, event: EmailEvent, options: EmailOptions = {}) {
  const message = await renderEmail(event, options);
  const from = process.env.EMAIL_FROM ?? (process.env.NODE_ENV === "production" ? "Nystara <noreply@nystara.com>" : "Nystara <noreply@nystara.local>");
  const headers = options.unsubscribeUrl ? {
    "List-Unsubscribe": `<${options.unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  } : undefined;
  if (process.env.NODE_ENV === "production") {
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
