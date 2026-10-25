import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="25 October 2026">
      <h2>1. Acceptance</h2>
      <p>By creating an account or using Nystara, you agree to these Terms. If you do not agree, do not use the platform.</p>

      <h2>2. Your account</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials and for all activity that
        occurs under your account. Notify us immediately of any unauthorised use at{" "}
        <a href="mailto:support@nystara.com">support@nystara.com</a>.
      </p>

      <h2>3. Content</h2>
      <p>
        You retain ownership of content you publish on Nystara. By publishing, you grant Nystara a non-exclusive,
        royalty-free licence to display and distribute your content on the platform. You agree not to publish content
        that is illegal, defamatory, harassing, or infringes third-party rights.
      </p>

      <h2>4. Prohibited conduct</h2>
      <p>
        You may not: attempt to gain unauthorised access to the platform or other accounts; scrape or harvest data
        without permission; use the platform to distribute malware or spam; impersonate another person or entity.
      </p>

      <h2>5. Subscriptions and payments</h2>
      <p>
        Paid subscriptions are billed in advance on a monthly or annual basis. Subscriptions auto-renew unless cancelled
        before the renewal date. Refunds are handled on a case-by-case basis — contact{" "}
        <a href="mailto:support@nystara.com">support@nystara.com</a>.
      </p>

      <h2>6. Termination</h2>
      <p>We may suspend or terminate accounts that violate these Terms. You may delete your account at any time from your profile settings.</p>

      <h2>7. Disclaimers</h2>
      <p>
        Nystara is provided &quot;as is&quot; without warranty of any kind. We do not guarantee uninterrupted
        availability or that the platform will meet your requirements.
      </p>

      <h2>8. Governing law</h2>
      <p>
        These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive
        jurisdiction of the courts of England and Wales.
      </p>
    </LegalPage>
  );
}
