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
  const subscription = await prisma.subscription.findUnique({ where: { userId: session.user.id }, select: { status: true, currentPeriodEnd: true } });
  const conversations = await prisma.aiConversation.findMany({ where: { userId: session.user.id }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, title: true, updatedAt: true } });
  return <AppShell><div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your writing companion</p>
    <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">A little help. A lot of possibility.</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Think out loud, explore an idea, or bring a draft. Your AI editor helps you find the words while keeping your voice.</p>
    <AiStudio premium={process.env.NODE_ENV === "development" || hasPremiumAccess(subscription)} owner={session.user.email ?? session.user.id} conversations={conversations.map((chat) => ({ ...chat, updatedAt: chat.updatedAt.toISOString() }))} />
  </div></AppShell>;
}
