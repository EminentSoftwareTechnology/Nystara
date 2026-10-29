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
        create an account or use our services. For member-only reading quotas, we record the article, timestamp, and
        your account ID or a random signed reader-cookie ID. We do not derive reader identities from IP addresses or
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
        controls. We do not sell your personal data.
      </p>

      <h2>3. Cookies</h2>
      <p>
        We use essential cookies required for authentication and security, theme preferences and a 30-day reader cookie
        for the free-reading quota. We do not currently set analytics cookies. See our{" "}
        <Link href="/cookies">Cookie Policy</Link> for details.
      </p>

      <h2>4. Data sharing</h2>
      <p>
        We share data only with service providers necessary to operate Nystara (payment processing via Stripe, email
        delivery via Resend, cloud storage). The operator must maintain appropriate agreements and retention settings
        with the providers it uses.
      </p>

      <h2>5. Data retention</h2>
      <p>
        We retain account data while your account is active. Reader cookies expire after 30 days; the operator runs
        daily cleanup to remove older reading records, expired sessions and expired verification tokens. Rate-limit keys
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
        <a href="mailto:privacy@nystara.com">privacy@nystara.com</a> to exercise any of these rights.
      </p>

      <h2>7. Changes to this policy</h2>
      <p>
        We may update this policy periodically. Material changes will be communicated via email or a prominent notice on
        the site. Continued use of Nystara after changes constitutes acceptance.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions about this policy? Email <a href="mailto:privacy@nystara.com">privacy@nystara.com</a>.
      </p>
    </LegalPage>
  );
}
