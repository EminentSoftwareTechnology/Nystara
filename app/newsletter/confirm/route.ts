import { prisma } from "@/lib/prisma";
import { readDigestToken } from "@/lib/digest";
import { newsletterPage } from "../page-html";

const expired = () => newsletterPage("This link has expired.", "Subscribe again from the Nystara footer to get a fresh confirmation email.", 400);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (url.searchParams.get("done") === "1") return newsletterPage("You’re subscribed.", "Your Nystara digest is on its way. Every email has a one-click unsubscribe link.", 200);
  if (!(await readDigestToken("digest-confirm", token))) return expired();
  return newsletterPage("Confirm your digest.", "Press the button to start receiving the Nystara digest at this address.", 200, { action: `/newsletter/confirm?token=${encodeURIComponent(token)}`, label: "Confirm subscription" });
}

export async function POST(request: Request) {
  const claim = await readDigestToken("digest-confirm", new URL(request.url).searchParams.get("token") ?? "");
  if (!claim) return expired();
  const { count } = await prisma.subscriber.updateMany({
    where: { id: claim.subscriberId },
    data: { confirmedAt: new Date(), ...(claim.frequency ? { frequency: claim.frequency } : {}) },
  });
  if (!count) return expired();
  return Response.redirect(new URL("/newsletter/confirm?done=1", request.url), 303);
}
