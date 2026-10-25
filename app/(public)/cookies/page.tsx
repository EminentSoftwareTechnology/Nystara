import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cookie Policy" };

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold mb-2">Cookie Policy</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Last updated: 1 May 2026</p>

      <div className="space-y-8 text-gray-700 dark:text-gray-300">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">What are cookies?</h2>
          <p>Cookies are small text files stored on your device when you visit a website. They allow the site to remember information about your visit, making subsequent visits easier and the site more useful to you.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Cookies we use</h2>
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">Essential</h3>
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">Always active</span>
              </div>
              <p className="text-sm mb-3">Required for the platform to function. Cannot be disabled.</p>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"><th className="pb-2 font-medium">Name</th><th className="pb-2 font-medium">Purpose</th><th className="pb-2 font-medium">Duration</th></tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  <tr><td className="py-2 font-mono text-xs">next-auth.session-token</td><td className="py-2">User authentication</td><td className="py-2">Session</td></tr>
                  <tr><td className="py-2 font-mono text-xs">admin_session</td><td className="py-2">Admin authentication</td><td className="py-2">8 hours</td></tr>
                  <tr><td className="py-2 font-mono text-xs">theme</td><td className="py-2">UI theme preference</td><td className="py-2">1 year</td></tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">Analytics</h3>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium">Optional</span>
              </div>
              <p className="text-sm mb-3">Help us understand how visitors interact with TechScribe so we can improve it.</p>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"><th className="pb-2 font-medium">Name</th><th className="pb-2 font-medium">Purpose</th><th className="pb-2 font-medium">Duration</th></tr></thead>
                <tbody>
                  <tr><td className="py-2 font-mono text-xs">vid</td><td className="py-2">Anonymous visitor tracking</td><td className="py-2">1 year</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Managing cookies</h2>
          <p>You can control cookies through your browser settings. Note that disabling essential cookies will prevent you from signing in or using core features. Most browsers allow you to block third-party cookies while keeping essential first-party cookies active.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Contact</h2>
          <p>Questions about our cookie use? Email <a href="mailto:privacy@techscribe.io" className="underline">privacy@techscribe.io</a>.</p>
        </section>
      </div>
    </div>
  );
}
