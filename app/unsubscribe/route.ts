import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unsubscribeUserId } from "@/lib/email/unsubscribe";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "Content-Type": "text/html; charset=utf-8" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const userId = await unsubscribeUserId(token);
  const preference = userId && url.searchParams.get("done") === "1"
    ? await prisma.user.findUnique({ where: { id: userId }, select: { activityEmails: true } })
    : null;
  const done = preference?.activityEmails === false;
  const title = done ? "You’re unsubscribed." : userId ? "Make room in your inbox." : "This link has expired.";
  const body = done ? "Activity emails are now off. Sign-in links and essential account and security messages will still reach you." : userId ? "Unsubscribe from welcome messages, story updates, comments, and replies. Sign-in links and essential account and security messages will continue." : "Sign in to manage your email preferences or open a recent unsubscribe link.";
  const form = userId && !done ? `<form method="post" action="/unsubscribe?token=${encodeURIComponent(token)}"><button type="submit" style="border:0;border-radius:999px;background:#14224a;color:#fff;padding:16px 24px;font-size:16px;cursor:pointer">Unsubscribe from activity emails</button></form>` : "";
  return new Response(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences · Nystara</title></head><body style="margin:0;background:#f7f7f4;color:#26251e;font:16px/1.7 Arial,sans-serif;padding:32px 16px"><main style="max-width:720px;margin:32px auto;border:1px solid #e6e5df;border-radius:24px;padding:32px;background:#fff"><a href="/" style="font:32px Georgia,serif;color:inherit;text-decoration:none">Nystara</a><h1 style="font:40px/1.2 Georgia,serif">${title}</h1><p>${body}</p>${form}<p><a href="/settings/notifications" style="color:#14224a">Email preferences</a> · <a href="/contact" style="color:#14224a">Contact</a> · <a href="/privacy" style="color:#14224a">Privacy</a></p></main></body></html>`, { status: userId || done ? 200 : 400, headers });
}

// The signed token authorises only disabling activity emails, including mailbox one-click POSTs.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const userId = await unsubscribeUserId(url.searchParams.get("token") ?? "");
  if (!userId) return NextResponse.json({ error: "Invalid or expired unsubscribe link" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  await prisma.user.updateMany({ where: { id: userId }, data: { activityEmails: false } });
  if (request.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(new URL(`/unsubscribe?done=1&token=${encodeURIComponent(url.searchParams.get("token") ?? "")}`, request.url), 303);
  return NextResponse.json({ unsubscribed: true }, { headers: { "Cache-Control": "no-store" } });
}
