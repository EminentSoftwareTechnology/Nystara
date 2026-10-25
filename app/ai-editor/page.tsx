import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPremiumAccess } from "@/lib/premium";
import AiStudio from "./AiStudio";

export const metadata: Metadata = { title: "AI editor" };
export const dynamic = "force-dynamic";

export default async function AiEditorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, currentPeriodEnd: true },
  });

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm text-muted">Premium writing companion</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">AI editor</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Polish a passage, tighten it, find a stronger title or get editorial feedback. Your voice stays yours: review
          every suggestion before you use it.
        </p>
        <AiStudio premium={hasPremiumAccess(subscription)} owner={session.user.email ?? session.user.id} />
      </div>
    </AppShell>
  );
}
