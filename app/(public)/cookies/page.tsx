import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = { title: "Cookie Policy" };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" updated="29 October 2026">
      <h2>What are cookies?</h2>
      <p>
        Cookies are small text files stored on your device when you visit a website. They allow the site to remember
        information about your visit, making subsequent visits easier and the site more useful to you.
      </p>

      <h2>Cookies we use</h2>
      <h3>Essential — always active</h3>
      <p>Required for the platform to function. Cannot be disabled.</p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Purpose</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="font-mono text-xs">authjs.session-token (secure prefix on HTTPS)</td>
            <td>User authentication</td>
            <td>Up to 30 days</td>
          </tr>
          <tr>
            <td className="font-mono text-xs">admin_session</td>
            <td>Admin authentication</td>
            <td>8 hours</td>
          </tr>
          <tr>
            <td className="font-mono text-xs">theme</td>
            <td>UI theme preference (light, dark, sand or system)</td>
            <td>1 year</td>
          </tr>
        </tbody>
      </table>

      <h3>Sign-in protection</h3>
      <p>
        The oauth_turnstile cookie records CAPTCHA pre-verification for up to 5 minutes. Sign-in also uses short-lived
        CSRF, state and PKCE cookies. The CAPTCHA is provided by Cloudflare Turnstile. Reading now requires sign-in, so
        we no longer set the former reader_session cookie and remove it if your browser still has one. No analytics or
        advertising cookies are set.
      </p>
      <p>
        The story editor keeps an unsaved draft in your browser&apos;s local storage so you don&apos;t lose work. It
        stays on your device and is cleared once the draft is saved or discarded.
      </p>

      <h2>Managing cookies</h2>
      <p>
        You can control cookies through your browser settings. Note that disabling essential cookies will prevent you
        from signing in or using core features. Most browsers allow you to block third-party cookies while keeping
        essential first-party cookies active.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about our cookie use? Email <a href="mailto:privacy@nystara.com">privacy@nystara.com</a>.
      </p>
    </LegalPage>
  );
}
