import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="29 October 2026">
      <h2>1. Information we collect</h2>
      <p>
        We collect information you provide directly — such as your name, email address, and profile details — when you
        create an account or use our services. For member-only reading quotas, we record the article, timestamp and
        your account ID. We do not derive reader identities from IP addresses or
        browser fingerprints. Request rate limits use short-lived keyed hashes; our hosting and CAPTCHA providers may
        process network and browser information.
      </p>

      <p>
        Reading articles and posting comments, reviews or ratings requires sign-in. To measure monthly active users,
        we record your account ID and the UTC dates when you use the signed-in site. We count each person once per
        calendar month, exclude fictional newsroom profiles, and do not add analytics cookies or store browsing paths
        in these activity records. Activity dates are included in your data export and removed with your account.
        Scheduled cleanup retains the current month and the preceding 11 months of activity dates.
      </p>

      <h2>2. How we use your information</h2>
      <p>
        We use your information to operate and improve Nystara, send sign-in emails and enforce access and security
        controls. We do not sell your personal data and do not use it for advertising.
      </p>
      <p>Under UK and EU data protection law, our lawful bases are:</p>
      <ul>
        <li>
          <strong>Contract</strong> — creating and running your account, publishing your stories, memberships and
          sign-in.
        </li>
        <li>
          <strong>Legitimate interests</strong> — security, abuse prevention, rate limiting and counting monthly
          active users. You can object at any time.
        </li>
        <li>
          <strong>Consent</strong> — optional emails such as digests and newsletters. You can withdraw consent with
          the unsubscribe link or in settings.
        </li>
        <li>
          <strong>Legal obligation</strong> — keeping billing records that tax law requires.
        </li>
      </ul>
      <p>
        If you use the AI editor, the text you submit is sent to OpenAI to generate suggestions. We ask OpenAI not to
        store these requests. Some stories on Nystara are AI-generated and written by fictional profiles. They are
        labelled as such, cannot sign in or receive email, and are not counted in public ratings or user metrics.
      </p>

      <h2>3. Cookies</h2>
      <p>
        We use only essential cookies, for authentication, security and your theme preference. We do not set analytics
        or advertising cookies. See our{" "}
        <Link href="/cookies">Cookie Policy</Link> for details.
      </p>

      <h2>4. Data sharing</h2>
      <p>
        We share data only with service providers that process it for us under contract: Railway (hosting and
        databases, EU region), Cloudflare (image storage and the Turnstile CAPTCHA), Stripe (payments), Resend (email
        delivery), Google (only if you choose Google sign-in) and OpenAI (only if you use the AI editor).
      </p>
      <p>
        Some of these providers are based in, or process data in, the United States and other countries outside the
        UK and EEA. Where personal data is transferred, we rely on UK or EU adequacy decisions (including the UK
        Extension to the EU–US Data Privacy Framework where the provider is certified) or on standard contractual
        clauses with the UK International Data Transfer Addendum.
      </p>

      <h2>5. Data retention</h2>
      <p>
        We retain account data while your account is active. We run daily cleanup to remove older reading records, expired sessions and expired verification tokens. Rate-limit keys
        expire after their enforcement window. Account deletion removes owned content and local authentication records;
        billing cancellation occurs before local deletion. Provider records, logs and backups follow the operator’s
        separately configured retention policies. You may request deletion at any time by emailing{" "}
        <a href="mailto:privacy@nystara.com">privacy@nystara.com</a>.
      </p>

      <h2>6. Your rights</h2>
      <p>
        Depending on your location, you may have the right to access, correct, or delete your personal data, or to
        restrict or object to its processing. Authenticated users can request their machine-readable data through{" "}
        <Link href="/api/me/export">data export</Link>; follow every section and next-page link to retrieve the full
        export. Contact us for help requesting account deletion. Contact us at{" "}
        <a href="mailto:privacy@nystara.com">privacy@nystara.com</a> to exercise any of these rights. We respond within
        one month.
      </p>
      <p>
        If you are unhappy with how we handle your data, you can complain to the UK Information Commissioner&apos;s
        Office (ICO) at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk/make-a-complaint</a>, or to the data
        protection authority where you live or work.
      </p>

      <h2>7. Changes to this policy</h2>
      <p>
        We may update this policy periodically. Material changes will be communicated via email or a prominent notice on
        the site before they take effect.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions about this policy? Email <a href="mailto:privacy@nystara.com">privacy@nystara.com</a>.
      </p>
    </LegalPage>
  );
}
