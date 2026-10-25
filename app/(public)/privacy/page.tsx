import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Last updated: 1 May 2026</p>

      <div className="prose dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">1. Information we collect</h2>
          <p>We collect information you provide directly — such as your name, email address, and profile details — when you create an account or use our services. We also collect usage data automatically, including pages visited, IP address, browser type, and referring URLs.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">2. How we use your information</h2>
          <p>We use your information to operate and improve TechScribe, send transactional emails (account confirmation, password resets), personalise your experience, and where you have opted in, send product updates. We do not sell your personal data.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">3. Cookies</h2>
          <p>We use essential cookies required for authentication and security, and optional analytics cookies to understand how users interact with the platform. See our <Link href="/cookies" className="underline">Cookie Policy</Link> for details.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">4. Data sharing</h2>
          <p>We share data only with service providers necessary to operate TechScribe (payment processing via Stripe, email delivery via Resend, cloud storage). These providers are contractually bound to protect your data.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">5. Data retention</h2>
          <p>We retain your data for as long as your account is active. You may request deletion at any time by emailing <a href="mailto:privacy@techscribe.io" className="underline">privacy@techscribe.io</a>.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">6. Your rights</h2>
          <p>Depending on your location, you may have the right to access, correct, or delete your personal data, or to restrict or object to its processing. Contact us at <a href="mailto:privacy@techscribe.io" className="underline">privacy@techscribe.io</a> to exercise any of these rights.</p>
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
