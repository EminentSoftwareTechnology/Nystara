import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProLaunched, planFor } from "@/lib/pro";
import { PRO_INTERVAL, PRO_PRICE } from "@/lib/plans";
import AppShell from "@/components/layout/AppShell";
import BillingButton from "@/components/billing/BillingButton";
import ProBadge from "@/components/billing/ProBadge";
import { CARD, LEARN } from "@/components/ui";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

const STATUS_LABEL = { ACTIVE: "Active", TRIALING: "Trial", PAST_DUE: "Payment failed", CANCELED: "Canceled" } as const;

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/settings/billing");
  const { checkout } = await searchParams;
  const [launched, user] = await Promise.all([
    isProLaunched(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        stripeCustomerId: true,
        subscription: { select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true } },
      },
    }),
  ]);
  const subscription = user?.subscription ?? null;
  const plan = planFor(launched, subscription);
  const date = subscription?.currentPeriodEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <AppShell>
      <div className="w-full max-w-3xl px-6 py-8">
        <h1 className="text-3xl font-semibold">Billing</h1>
        <p className="mt-2 mb-8 text-sm text-muted">Your plan and payments.</p>

        {checkout === "success" && (
          <p role="status" className={`${CARD} mb-4 px-5 py-4 text-sm`}>
            Thank you for going Pro. It can take a few seconds for Stripe to confirm your payment; refresh this page if
            your plan still shows Free.
          </p>
        )}

        <section className={`${CARD} p-6`} aria-labelledby="current-plan">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Current plan</p>
          <h2 id="current-plan" className="mt-2 flex items-center gap-2 text-2xl font-semibold">
            {plan.subscribed ? <>Pro <ProBadge /></> : launched ? "Free" : "Free beta, with every Pro feature"}
          </h2>

          {subscription && (
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Status</dt>
                <dd className="font-medium">{STATUS_LABEL[subscription.status]}</dd>
              </div>
              <div>
                <dt className="text-muted">
                  {subscription.status === "CANCELED" || subscription.cancelAtPeriodEnd ? "Access ends" : "Renews"}
                </dt>
                <dd className="font-medium">{date}</dd>
              </div>
            </dl>
          )}

          {subscription?.status === "PAST_DUE" && (
            <p role="alert" className="mt-5 text-sm text-danger">
              Your last payment did not go through. Update your card to keep Pro.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-start gap-3">
            {launched && !plan.subscribed && (!subscription || subscription.status === "CANCELED") && (
              <BillingButton action="checkout" label={`Upgrade to Pro, ${PRO_PRICE}/${PRO_INTERVAL}`} />
            )}
            {user?.stripeCustomerId && (
              <BillingButton action="portal" label="Manage billing" variant="secondary" />
            )}
          </div>

          {!launched && !plan.subscribed && (
            <p className="mt-6 text-sm leading-6 text-muted">
              Nystara is in beta, so the AI editor, Pro themes, scheduling and listening mode are free for everyone.
              Pro will cost {PRO_PRICE} a {PRO_INTERVAL} when it launches.
            </p>
          )}
        </section>

        <p className="mt-6 text-sm">
          <Link href="/pricing" className={LEARN}>Compare plans</Link>
        </p>
      </div>
    </AppShell>
  );
}
