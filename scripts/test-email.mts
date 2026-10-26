import nextEnv from "@next/env";
import { z } from "zod";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
const to = z.email().parse(process.argv[process.argv.indexOf("--to") + 1]);
const { usesResend } = await import("../lib/email/provider");
if (!usesResend()) throw new Error("email:test requires Resend");
const { deliverEmail } = await import("../lib/email/send");
const { renderEmail } = await import("../lib/email/templates");
for (const event of ["welcome", "sign-in"] as const) {
  const message = await renderEmail(event, {
    name: "Nystara reader",
    detail: "This is a requested email delivery test. The sign-in button opens the login page; this test contains no authentication token.",
    actionPath: event === "sign-in" ? "/login" : "/",
  });
  const id = await deliverEmail(to, { ...message, subject: `[Email test] ${message.subject}` });
  console.log(JSON.stringify({ event, id, status: "accepted", origin: process.env.NEXTAUTH_URL }));
  await new Promise((resolve) => setTimeout(resolve, 600));
}
