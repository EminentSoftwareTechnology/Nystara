import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { PageIntro } from "@/components/marketing/Heading";
import { CARD, SECTION, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "About" };

const SECTIONS = [
  {
    title: "Our mission",
    body: "To give people a home for writing that matters: decisions, hard-won lessons, deep dives and stories from the field. Writing that readers bookmark and return to months later.",
  },
  {
    title: "For writers",
    body: "Nystara gives you a clean writing environment and a focused audience. Publish publicly or behind a member paywall. Your writing belongs to you.",
  },
  {
    title: "For readers",
    body: "Public stories are always free. Become a member to read premium stories and support the writers who spend hours crafting them.",
  },
];

export default function AboutPage() {
  return (
    <div>
      <PageIntro eyebrow="About" title="About Nystara">
        Nystara is a blog platform for long-form writing. The best knowledge is written thoughtfully — not in 280
        characters, but in the depth a hard problem deserves.
      </PageIntro>

      <section className={SECTION}>
        <div className="grid gap-3 lg:grid-cols-3">
          {SECTIONS.map(({ title, body }) => (
            <div key={title} className={`${CARD} flex flex-col gap-2.5 p-6`}>
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <p className="text-sm leading-6 text-muted">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/why-blog" className={buttonClass("primary", "md")}>
            Why blog <ArrowRightIcon size={16} />
          </Link>
          <Link href="/contact" className={buttonClass("secondary", "md")}>
            Contact us
          </Link>
        </div>
      </section>
    </div>
  );
}
