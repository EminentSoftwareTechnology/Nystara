import type { Metadata } from "next";
import { MailIcon } from "@/components/icons";
import { PageIntro } from "@/components/marketing/Heading";
import { CARD, TILE, SECTION } from "@/components/ui";

export const metadata: Metadata = { title: "Contact" };

const CHANNELS = [
  { title: "General and support", email: "support@nystara.com" },
  { title: "Privacy", email: "privacy@nystara.com" },
  { title: "Security", email: "security@nystara.com" },
];

export default function ContactPage() {
  return (
    <div>
      <PageIntro eyebrow="Contact" title="Get in touch">
        Have a question, an idea, or need help with your account? We&apos;d love to hear from you.
      </PageIntro>

      <section className={SECTION}>
        <ul className="grid gap-3 sm:grid-cols-3">
          {CHANNELS.map(({ title, email }) => (
            <li key={email} className={`${TILE} flex flex-col items-start gap-4 p-6`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
                <MailIcon size={19} />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="font-semibold">{title}</h2>
                <a href={`mailto:${email}`} className="text-sm text-muted underline underline-offset-4 hover:text-foreground">
                  {email}
                </a>
              </div>
            </li>
          ))}
        </ul>

        <div className={`${CARD} mt-6 p-6`}>
          <h2 className="font-semibold">Response times</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            We aim to respond to all enquiries within 2 business days. Support requests for account issues are typically
            resolved within 24 hours.
          </p>
        </div>
      </section>
    </div>
  );
}
