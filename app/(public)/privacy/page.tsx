import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Last updated: 25 October 2026</p>

      <div className="prose dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">1. Information we collect</h2>
          <p>We collect information you provide directly — such as your name, email address, and profile details — when you create an account or use our services. For member-only reading quotas, we record the article, timestamp, and your account ID or a random signed reader-cookie ID. We do not derive reader identities from IP addresses or browser fingerprints. Request rate limits use short-lived keyed hashes; our hosting and CAPTCHA providers may process network and browser information.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">2. How we use your information</h2>
          <p>We use your information to operate and improve TechScribe, send sign-in emails and enforce access and security controls. We do not sell your personal data.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">3. Cookies</h2>
          <p>We use essential cookies required for authentication and security, theme preferences and a 30-day reader cookie for the free-reading quota. We do not currently set analytics cookies. See our <Link href="/cookies" className="underline">Cookie Policy</Link> for details.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">4. Data sharing</h2>
          <p>We share data only with service providers necessary to operate TechScribe (payment processing via Stripe, email delivery via Resend, cloud storage). The operator must maintain appropriate agreements and retention settings with the providers it uses.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">5. Data retention</h2>
          <p>We retain account data while your account is active. Reader cookies expire after 30 days; the operator runs daily cleanup to remove older reading records, expired sessions and expired verification tokens. Rate-limit keys expire after their enforcement window. Account deletion removes owned content and local authentication records; billing cancellation occurs before local deletion. Provider records, logs and backups follow the operator’s separately configured retention policies. You may request deletion at any time by emailing <a href="mailto:privacy@techscribe.io" className="underline">privacy@techscribe.io</a>.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">6. Your rights</h2>
          <p>Depending on your location, you may have the right to access, correct, or delete your personal data, or to restrict or object to its processing. Authenticated users can request their machine-readable data through <Link href="/api/me/export" className="underline">data export</Link>; follow every section and next-page link to retrieve the full export. Contact us for help requesting account deletion. Contact us at <a href="mailto:privacy@techscribe.io" className="underline">privacy@techscribe.io</a> to exercise any of these rights.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">7. Changes to this policy</h2>
          <p>We may update this policy periodically. Material changes will be communicated via email or a prominent notice on the site. Continued use of TechScribe after changes constitutes acceptance.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">8. Contact</h2>
          <p>Questions about this policy? Email <a href="mailto:privacy@techscribe.io" className="underline">privacy@techscribe.io</a>.</p>
        </section>
      </div>
    </div>
  );
}
