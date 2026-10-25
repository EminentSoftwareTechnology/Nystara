import type { Metadata } from "next";
import { Eyebrow, Heading, PageIntro } from "@/components/marketing/Heading";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { Wall } from "@/components/marketing/Wall";
import { READER_FEATURES, WRITER_FEATURES } from "@/components/marketing/features";
import { CARD, SECTION } from "@/components/ui";

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
              <dd className="font-display text-5xl font-medium tracking-tight">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="writers" className={SECTION}>
        <Heading eyebrow="For writers" id="writers" title="Write, publish and grow in one place." />
        <FeatureGrid features={WRITER_FEATURES} />
      </section>

      <section aria-labelledby="paywall" className={SECTION}>
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-12">
          <div className="flex flex-col gap-4">
            <Eyebrow>Member-only stories</Eyebrow>
            <h2 id="paywall" className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
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
        <FeatureGrid features={READER_FEATURES} />
      </section>

    </div>
  );
}
