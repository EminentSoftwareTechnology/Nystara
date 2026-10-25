import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { EMAIL_EVENTS, EMAIL_THEMES, appLink, renderEmail, type EmailEvent } from "../lib/email/templates";
import { sendEmail } from "../lib/email/send";

const output = process.env.EMAIL_PREVIEW_DIR ?? "/private/tmp/nystara-email-previews";
const send = process.argv.includes("--send");
if (process.env.NODE_ENV === "production") throw new Error("Email previews are local only");
const smtp = new URL(process.env.EMAIL_SERVER ?? "smtp://127.0.0.1:1035");
if (!["127.0.0.1", "localhost", "[::1]"].includes(smtp.hostname) || !["smtp:", "smtps:"].includes(smtp.protocol)) throw new Error("Preview delivery requires local Mailpit SMTP");
process.env.EMAIL_FROM = "Nystara Preview <noreply@nystara.local>";
await mkdir(output, { recursive: true });
const previews: { event: EmailEvent; theme: string; file: string; subject: string }[] = [];
for (const theme of EMAIL_THEMES) {
  for (const event of Object.keys(EMAIL_EVENTS) as EmailEvent[]) {
    const options = { theme, name: "Alex Morgan", detail: event.startsWith("story-") ? "The quiet art of paying attention" : undefined, actionUrl: event === "sign-in" ? appLink("/verify?token=synthetic-preview-only&provider=nodemailer") : undefined, unsubscribeUrl: EMAIL_EVENTS[event].category === "activity" ? appLink("/unsubscribe?token=synthetic-preview-only") : undefined };
    const message = await renderEmail(event, options);
    const file = `${theme}-${event}.html`;
    await writeFile(path.join(output, file), message.html);
    await writeFile(path.join(output, `${theme}-${event}.txt`), message.text);
    if (send) await sendEmail(`preview+${theme}-${event}@nystara.test`, event, options);
    previews.push({ event, theme, file, subject: message.subject });
  }
}
await writeFile(path.join(output, "manifest.json"), JSON.stringify(previews, null, 2));
await writeFile(path.join(output, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nystara email gallery</title></head><body style="font:16px/1.6 Arial;background:#f7f7f4;color:#26251e;padding:24px"><h1>Nystara email gallery</h1><p>${previews.length} templates · light, dark and sand · synthetic preview data only</p>${EMAIL_THEMES.map((theme) => `<h2>${theme}</h2><ul>${previews.filter((item) => item.theme === theme).map((item) => `<li><a href="${item.file}">${item.event}: ${item.subject}</a></li>`).join("")}</ul>`).join("")}</body></html>`);
console.log(`${previews.length} email variants rendered${send ? " and sent to local Mailpit" : ""}. Gallery: ${output}/index.html`);
