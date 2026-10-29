import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getPlan, isProLaunched, type Plan } from "@/lib/pro";
import { AI_DAILY_LIMIT, PRO_INTERVAL, PRO_PRICE } from "@/lib/plans";
import { Heading, PageIntro } from "@/components/marketing/Heading";
import BillingButton from "@/components/billing/BillingButton";
import { CheckIcon } from "@/components/icons";
import { CARD, SECTION, buttonClass, cx } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Write and publish on Nystara for free. Nystara Pro adds the AI editor, Pro themes, scheduling, listening mode and unlimited member stories for ${PRO_PRICE} a ${PRO_INTERVAL}.`,
};
export const dynamic = "force-dynamic";

const FREE = [
  "Unlimited stories, drafts and publishing",
  "Rich editor with images, video and Markdown import",
  "Classic, Modern and Technical story themes",
  "5 members-only stories every 30 days",
  "Library, reading lists, highlights and follows",
  "Story stats and audience insights",
];

const PRO = [
  `AI editor: brainstorm, outline and polish (${AI_DAILY_LIMIT} requests a day)`,
  "Unlimited members-only stories",
  "Editorial, Elegant and Bold story themes",
  "Scheduled publishing",
  "Listen to any story read aloud",
  "Pro badge on your profile and bylines",
];

const COMPARE: { feature: string; free: string | boolean; pro: string | boolean }[] = [
  { feature: "Write and publish stories", free: "Unlimited", pro: "Unlimited" },
  { feature: "Members-only stories you can read", free: "5 per 30 days", pro: "Unlimited" },
  { feature: "AI editor", free: false, pro: `${AI_DAILY_LIMIT} requests a day` },
  { feature: "Story themes", free: "3", pro: "All 6" },
  { feature: "Scheduled publishing", free: false, pro: true },
  { feature: "Listen to stories", free: false, pro: true },
  { feature: "Pro badge", free: false, pro: true },
  { feature: "Stats, library, comments and follows", free: true, pro: true },
  { feature: "Two-factor security and data export", free: true, pro: true },
];

const FAQ = [
  {
    q: "Can I cancel any time?",
    a: "Yes. Open Settings, then Billing, and manage your plan in the Stripe portal. Pro stays active until the end of the period you have paid for.",
  },
  {
    q: "What happens to my stories if I cancel?",
    a: "Nothing is deleted. Stories keep any Pro theme they already use and stories you have scheduled still publish. You go back to the free limits for new changes.",
  },
  {
    q: "Who handles my payment details?",
    a: "Stripe. You pay on Stripe's hosted checkout, so Nystara never sees or stores your card number.",
  },
  {
    q: "What happens to text I send to the AI editor?",
    a: "It is sent to our AI provider with storage switched off. Your chats are saved in your Nystara account so you can return to them, and you can delete them at any time.",
  },
  {
    q: "How does listening work?",
    a: "Your browser reads the story aloud with the voices on your device. No audio is generated on our servers.",
  },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <><CheckIcon className="mx-auto h-4 w-4" /><span className="sr-only">Included</span></>;
  if (value === false) return <><span aria-hidden className="text-muted">—</span><span className="sr-only">Not included</span></>;
  return <span>{value}</span>;
}

function ProAction({ signedIn, plan }: { signedIn: boolean; plan: Plan | null }) {
  if (!signedIn) return <Link href="/login?next=/pricing" className={buttonClass("primary", "lg", "w-full")}>Sign in to upgrade</Link>;
  if (!plan?.launched) return <span className={buttonClass("secondary", "lg", "w-full pointer-events-none")}>Included free during beta</span>;
  if (plan.subscribed) return <Link href="/settings/billing" className={buttonClass("secondary", "lg", "w-full")}>Manage billing</Link>;
  return <BillingButton action="checkout" label="Upgrade to Pro" className="w-full" />;
}

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;
  const plan = userId ? await getPlan(userId) : null;
  const launched = plan?.launched ?? (await isProLaunched());

  return (
    <div>
      <PageIntro eyebrow="Pricing" title={`Write for free. Go Pro for ${PRO_PRICE}.`}>
        Everything you need to write and publish is free. Pro adds an AI editor, extra polish for your stories and
        unlimited reading, for less than a coffee a month.
      </PageIntro>

      <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
        {checkout === "canceled" && (
          <p role="status" className={`${CARD} mb-4 px-5 py-4 text-sm`}>
            Checkout was canceled. You have not been charged.
          </p>
        )}
        {!launched && (
          <p role="status" className="mb-4 rounded-2xl border border-amber-300/70 bg-amber-100/60 px-5 py-4 text-sm text-foreground dark:bg-amber-300/10">
            <strong>Nystara is in beta.</strong> Every Pro feature is free for all members until Pro launches. We will
            let you know before anything changes.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <article className={`${CARD} flex flex-col p-6 sm:p-8`} aria-labelledby="plan-free">
            <h2 id="plan-free" className="text-lg font-semibold">Free</h2>
            <p className="mt-1 text-sm text-muted">For writers and readers getting started.</p>
            <p className="mt-6 flex items-baseline gap-1">
              <span className="font-display text-5xl font-medium tracking-tight">$0</span>
              <span className="text-sm text-muted">forever</span>
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
              {FREE.map((item) => (
                <li key={item} className="flex gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              {userId ? (
                <span className={buttonClass("secondary", "lg", "w-full pointer-events-none")}>
                  {plan?.subscribed ? "Included in Pro" : "Your current plan"}
                </span>
              ) : (
                <Link href="/signup" className={buttonClass("secondary", "lg", "w-full")}>Start writing</Link>
              )}
            </div>
          </article>

          <article
            className={cx(CARD, "relative flex flex-col border-foreground p-6 ring-1 ring-foreground sm:p-8")}
            aria-labelledby="plan-pro"
          >
            <span className="absolute right-6 top-6 rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-semibold text-black">
              Recommended
            </span>
            <h2 id="plan-pro" className="text-lg font-semibold">Pro</h2>
            <p className="mt-1 text-sm text-muted">For writers who publish often and readers who read a lot.</p>
            <p className="mt-6 flex items-baseline gap-1">
              <span className="font-display text-5xl font-medium tracking-tight">{PRO_PRICE}</span>
              <span className="text-sm text-muted">per {PRO_INTERVAL}</span>
            </p>
            <p className="mt-1 text-xs text-muted">Billed monthly. Cancel any time.</p>
            <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
              <li className="text-xs font-medium uppercase tracking-wider text-muted">Everything in Free, plus</li>
              {PRO.map((item) => (
                <li key={item} className="flex gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <ProAction signedIn={!!userId} plan={plan} />
            </div>
          </article>
        </div>
      </section>

      <section aria-labelledby="compare" className={SECTION}>
        <Heading eyebrow="Compare" id="compare" title="What each plan includes" />
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-5 py-4 font-medium text-muted">Feature</th>
                <th scope="col" className="w-36 px-5 py-4 text-center font-semibold">Free</th>
                <th scope="col" className="w-36 px-5 py-4 text-center font-semibold">Pro</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.feature} className="border-b border-border last:border-0">
                  <th scope="row" className="px-5 py-3.5 text-left font-normal">{row.feature}</th>
                  <td className="px-5 py-3.5 text-center"><Cell value={row.free} /></td>
                  <td className="px-5 py-3.5 text-center"><Cell value={row.pro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="faq" className={SECTION}>
        <Heading eyebrow="Questions" id="faq" title="Pricing questions, answered" />
        <div className="grid gap-3 md:grid-cols-2">
          {FAQ.map(({ q, a }) => (
            <details key={q} className={`${CARD} group p-5`}>
              <summary className="cursor-pointer list-none font-medium marker:hidden">{q}</summary>
              <p className="mt-3 text-sm leading-6 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
