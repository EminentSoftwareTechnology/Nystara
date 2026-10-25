import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import NotificationSettings from "./NotificationSettings";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { emailTheme: true, activityEmails: true, digest: { select: { frequency: true } } } });
  if (!user) redirect("/login");
  return <AppShell><div className="mx-auto w-full max-w-3xl px-6 py-8">
    <Link href="/settings" className="text-sm text-muted underline">Profile settings</Link>
    <h1 className="mt-6 font-display text-4xl">Email preferences</h1>
    <p className="mt-3 mb-8 text-muted">Choose the emails you receive and how they look in your inbox.</p>
    <NotificationSettings preferences={{ emailTheme: user.emailTheme, activityEmails: user.activityEmails, digest: user.digest?.frequency ?? "OFF" }} />
  </div></AppShell>;
}
