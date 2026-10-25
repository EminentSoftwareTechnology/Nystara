import { prisma } from "../prisma";
import { isExplicitTheme } from "../theme";
import { appLink, EMAIL_EVENTS, type EmailEvent, type EmailOptions } from "./templates";
import { unsubscribeToken } from "./unsubscribe";
import { sendEmail } from "./send";

type NotificationOptions = Pick<EmailOptions, "detail" | "actionPath">;

// Notifications must not turn an already committed account/story change into a failed request.
export async function notifyUser(userId: string, event: EmailEvent, options: NotificationOptions = {}) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, emailTheme: true, activityEmails: true } });
    if (!user || (EMAIL_EVENTS[event].category === "activity" && !user.activityEmails)) return;
    const unsubscribeUrl = EMAIL_EVENTS[event].category === "activity" ? appLink(`/unsubscribe?token=${await unsubscribeToken(userId)}`) : undefined;
    await sendEmail(user.email, event, { ...options, name: user.name, theme: isExplicitTheme(user.emailTheme) ? user.emailTheme : "light", unsubscribeUrl });
  } catch {
    console.error("Notification delivery failed", { event });
  }
}

export async function notifyEmail(email: string, event: "account-deleted", options: NotificationOptions = {}) {
  try {
    await sendEmail(email, event, options);
  } catch {
    console.error("Notification delivery failed", { event });
  }
}
