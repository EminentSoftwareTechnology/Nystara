import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { Heading, PageIntro } from "@/components/marketing/Heading";
import { Wall } from "@/components/marketing/Wall";
import { type Feature, READER_FEATURES, WRITER_FEATURES } from "@/components/marketing/features";
import { CARD, SECTION, buttonClass } from "@/components/ui";

export const metadata: Metadata = {
  title: "Features",
  description: "Everything Nystara gives writers and readers: a calm editor, member-only stories, stats, a library and more.",
};

const FACTS = [
  { value: "5", label: "member-only stories free every 30 days" },
  { value: "4", label: "themes, including sand and system" },
  { value: "0", label: "advertising or tracking cookies" },
  { value: "3", label: "ways to sign in: email link, Google or GitHub" },
];

function Grid({ features }: { features: Feature[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {features.map(({ Icon, title, body }) => (
        <div key={title} className={`${CARD} flex flex-col gap-2.5 p-5`}>
          <Icon className="text-muted" />
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm leading-6 text-muted">{body}</p>
        </div>
      ))}
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <div>
      <PageIntro eyebrow="Features" title="Everything between a draft and a devoted reader.">
        Nystara keeps the tools simple so the writing stays the focus, for the people writing and the people
        reading.
      </PageIntro>

      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {FACTS.map((f) => (
            <div key={f.label} className={`${CARD} flex flex-col-reverse gap-1 p-5`}>
              <dt className="text-sm text-muted">{f.label}</dt>
              <dd className="text-3xl font-semibold tracking-tight">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="writers" className={SECTION}>
        <Heading eyebrow="For writers" id="writers" title="Write, publish and grow in one place." />
        <Grid features={WRITER_FEATURES} />
      </section>

      <section aria-labelledby="paywall" className={SECTION}>
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-12">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">Member-only stories</p>
            <h2 id="paywall" className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Free to read, with room to support the writers you love.
            </h2>
            <p className="leading-7 text-muted">
              Mark any story member-only. Every reader gets five of them free in each 30-day window, then sees an
              excerpt and an invitation to become a member. Public stories are always free.
            </p>
          </div>
          <Wall id="paywall-wall" variant={0} className="px-6 py-10 sm:px-10 sm:py-14">
            <div className="mx-auto max-w-md rounded-2xl border border-border bg-page/95 p-6">
              <span className="inline-flex rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium">
                Member-only
              </span>
              <p className="mt-3 text-xl font-semibold tracking-tight">Designing for failure at scale</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                The first three hundred words are free. Keep reading with one of your five free member stories…
              </p>
            </div>
          </Wall>
        </div>
      </section>

      <section aria-labelledby="readers" className={SECTION}>
        <Heading eyebrow="For readers" id="readers" title="Read comfortably, on your terms." />
        <Grid features={READER_FEATURES} />
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 pb-24 pt-10 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">See it for yourself.</h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/signup" className={buttonClass("primary", "lg")}>
            Create your account <ArrowRightIcon size={16} />
          </Link>
          <Link href="/#latest" className={buttonClass("secondary", "lg")}>
            Read the blog
          </Link>
        </div>
      </section>
    </div>
  );
}
