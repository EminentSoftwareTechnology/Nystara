import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, BookIcon, ChatIcon, CheckIcon, SparkIcon, UsersIcon } from "@/components/icons";
import { Heading, PageIntro } from "@/components/marketing/Heading";
import { Wall } from "@/components/marketing/Wall";
import { CARD, SECTION, buttonClass } from "@/components/ui";

export const metadata: Metadata = {
  title: "Why blog",
  description: "Why long-form writing still matters, and why Nystara is a good place to do it.",
};

const REASONS = [
  {
    Icon: SparkIcon,
    title: "Writing sharpens your thinking",
    body: "Explaining something end to end exposes the gaps you didn’t know you had. Every story leaves you understanding your subject better than when you started.",
  },
  {
    Icon: BookIcon,
    title: "Your work compounds",
    body: "Social posts fade within a day. A well-written story keeps being found, shared and bookmarked for years, and each one adds to a body of work.",
  },
  {
    Icon: UsersIcon,
    title: "The right people find you",
    body: "Readers who care about what you care about follow you. Over time that becomes an audience that knows your thinking before they ever meet you.",
  },
  {
    Icon: ChatIcon,
    title: "You join the conversation",
    body: "A thoughtful story is a contribution others can build on, cite and respond to. It moves your field forward in a way a quick take can’t.",
  },
];

const STEPS = [
  { title: "Create your account", body: "Sign in with a one-time email link, Google or GitHub. No password to remember." },
  { title: "Write your first story", body: "Open the editor, write in peace and save as a draft until it’s ready." },
  { title: "Publish and share", body: "Publish openly or for members. Add tags so the right readers find it." },
  { title: "Learn and keep going", body: "Check your stats to see what resonates, then write the next one." },
];

const PROMISES = [
  "You keep ownership of everything you publish",
  "No advertising or tracking cookies",
  "Export your data whenever you like",
  "Readers get 5 member-only stories free every 30 days",
];

export default function WhyBlogPage() {
  return (
    <div>
      <PageIntro eyebrow="Why blog" title="A post disappears in a day. A good story keeps working for years.">
        Blogging isn’t about chasing a feed. It’s about putting your best thinking somewhere it can be found, read
        properly and built on.
      </PageIntro>

      <section aria-labelledby="reasons" className={SECTION}>
        <Heading eyebrow="The case for writing" id="reasons" title="Four reasons to start a blog this year." />
        <div className="grid gap-3 sm:grid-cols-2">
          {REASONS.map(({ Icon, title, body }) => (
            <div key={title} className={`${CARD} flex flex-col gap-2.5 p-6`}>
              <Icon className="text-muted" />
              <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
              <p className="text-sm leading-6 text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="why-nystara" className={SECTION}>
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-12">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">Why Nystara</p>
            <h2 id="why-nystara" className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Built for depth, not for the scroll.
            </h2>
            <p className="leading-7 text-muted">
              Nystara gives you a calm editor, a focused audience and the choice to publish openly or for members.
              No algorithmic noise, no ads, just stories and the people who read them.
            </p>
            <ul className="flex flex-col gap-2.5 text-sm">
              {PROMISES.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckIcon size={16} className="mt-0.5 shrink-0 text-muted" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <Wall id="why-nystara-wall" variant={1} className="px-6 py-10 sm:px-10 sm:py-14">
            <div className="mx-auto max-w-md rounded-2xl border border-border bg-page/95 p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Draft</p>
              <p className="mt-3 text-xl font-semibold tracking-tight">What I learned migrating a monolith</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Eighteen months, three false starts and one rule that finally made it work…
              </p>
              <div className="mt-5 flex items-center justify-between text-xs text-muted">
                <span>7 min read</span>
                <span className="rounded-full bg-accent px-3 py-1 font-medium text-accent-foreground">Publish</span>
              </div>
            </div>
          </Wall>
        </div>
      </section>

      <section aria-labelledby="start" className={SECTION}>
        <Heading eyebrow="Getting started" id="start" title="From blank page to published in four steps." />
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className={`${CARD} flex flex-col gap-2 p-5`}>
              <span className="text-3xl font-semibold tracking-tight text-muted">{i + 1}</span>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-sm leading-6 text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 pb-24 pt-10 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your first story is the hardest. Start it today.</h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/signup" className={buttonClass("primary", "lg")}>
            Start writing <ArrowRightIcon size={16} />
          </Link>
          <Link href="/features" className={buttonClass("secondary", "lg")}>
            Explore features
          </Link>
        </div>
      </section>
    </div>
  );
}
