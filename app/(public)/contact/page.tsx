import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold mb-4">Contact us</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-10 text-lg">
        Have a question, a partnership idea, or need help with your account? We&apos;d love to hear from you.
      </p>

      <div className="grid md:grid-cols-2 gap-10 mb-12">
        <div>
          <h2 className="text-lg font-semibold mb-2">General enquiries</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            <a href="mailto:hello@techscribe.io" className="underline hover:text-gray-900 dark:hover:text-white">
              hello@techscribe.io
            </a>
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">Support</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            <a href="mailto:support@techscribe.io" className="underline hover:text-gray-900 dark:hover:text-white">
              support@techscribe.io
            </a>
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">Press</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            <a href="mailto:press@techscribe.io" className="underline hover:text-gray-900 dark:hover:text-white">
              press@techscribe.io
            </a>
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">Partnerships</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            <a href="mailto:partners@techscribe.io" className="underline hover:text-gray-900 dark:hover:text-white">
              partners@techscribe.io
            </a>
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-8 bg-gray-50 dark:bg-gray-900">
        <h2 className="text-xl font-semibold mb-1">Response times</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          We aim to respond to all enquiries within 2 business days. Support requests for account
          issues are typically resolved within 24 hours.
        </p>
      </div>
    </div>
  );
}
