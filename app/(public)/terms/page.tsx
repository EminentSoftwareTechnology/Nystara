import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Last updated: 1 May 2026</p>

      <div className="space-y-8 text-gray-700 dark:text-gray-300">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">1. Acceptance</h2>
          <p>By creating an account or using TechScribe, you agree to these Terms. If you do not agree, do not use the platform.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">2. Your account</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately of any unauthorised use at <a href="mailto:support@techscribe.io" className="underline">support@techscribe.io</a>.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">3. Content</h2>
          <p>You retain ownership of content you publish on TechScribe. By publishing, you grant TechScribe a non-exclusive, royalty-free licence to display and distribute your content on the platform. You agree not to publish content that is illegal, defamatory, harassing, or infringes third-party rights.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">4. Prohibited conduct</h2>
          <p>You may not: attempt to gain unauthorised access to the platform or other accounts; scrape or harvest data without permission; use the platform to distribute malware or spam; impersonate another person or entity.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">5. Subscriptions and payments</h2>
          <p>Paid subscriptions are billed in advance on a monthly or annual basis. Subscriptions auto-renew unless cancelled before the renewal date. Refunds are handled on a case-by-case basis — contact <a href="mailto:support@techscribe.io" className="underline">support@techscribe.io</a>.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">6. Termination</h2>
          <p>We may suspend or terminate accounts that violate these Terms. You may delete your account at any time from your profile settings.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">7. Disclaimers</h2>
          <p>TechScribe is provided &quot;as is&quot; without warranty of any kind. We do not guarantee uninterrupted availability or that the platform will meet your requirements.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">8. Governing law</h2>
          <p>These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
        </section>
      </div>
    </div>
  );
}
