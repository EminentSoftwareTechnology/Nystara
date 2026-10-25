import type { EmailProviderSendVerificationRequestParams } from "next-auth/providers/email";
import { prisma } from "../prisma";
import { isExplicitTheme } from "../theme";
import { sendEmail } from "./send";

export async function sendSignInEmail({ identifier, url, request }: EmailProviderSendVerificationRequestParams) {
  const user = await prisma.user.findUnique({ where: { email: identifier }, select: { emailTheme: true } });
  const cookieTheme = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("theme="))?.slice(6);
  const theme = isExplicitTheme(user?.emailTheme) ? user.emailTheme : isExplicitTheme(cookieTheme) ? cookieTheme : "light";
  await sendEmail(identifier, "sign-in", { theme, actionUrl: url });
}
