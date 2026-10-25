import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readDigestToken } from "@/lib/digest";
import { newsletterPage } from "../page-html";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (url.searchParams.get("done") === "1") return newsletterPage("You’re unsubscribed.", "You won’t receive the Nystara digest any more, and we’ve deleted your address from the digest list.", 200);
  if (!(await readDigestToken("digest-unsubscribe", token))) return newsletterPage("This link has expired.", "Sign in to manage your email preferences, or open the link in a more recent digest.", 400);
  return newsletterPage("Leaving the digest?", "Press the button to stop the Nystara digest and remove this address from the list.", 200, { action: `/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, label: "Unsubscribe" });
}

// Also the target of mailbox one-click unsubscribe (RFC 8058), so it needs no page visit.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const claim = await readDigestToken("digest-unsubscribe", url.searchParams.get("token") ?? "");
  if (!claim) return NextResponse.json({ error: "Invalid or expired unsubscribe link" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  await prisma.subscriber.deleteMany({ where: { id: claim.subscriberId } });
  if (request.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(new URL("/newsletter/unsubscribe?done=1", request.url), 303);
  return NextResponse.json({ unsubscribed: true }, { headers: { "Cache-Control": "no-store" } });
}
