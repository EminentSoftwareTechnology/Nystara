import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import ProfileSettings from "./ProfileSettings";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, bio: true, username: true, avatarUrl: true, image: true },
  });
  if (!user) redirect("/login");
  return (
    <AppShell>
      <div className="w-full px-6 py-8">
        <h1 className="text-3xl font-semibold">Profile settings</h1>
        <p className="mt-2 mb-8 text-sm text-muted">
          Choose how you appear to readers.
        </p>
        <ProfileSettings user={{ ...user, avatarUrl: user.avatarUrl ?? user.image }} />
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/settings/notifications" className="underline">Email preferences and unsubscribe</Link>
          <Link href="/settings/billing" className="underline">Plan and billing</Link>
        </div>
      </div>
    </AppShell>
  );
}
