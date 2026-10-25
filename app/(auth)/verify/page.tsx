import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Confirm sign-in", referrer: "no-referrer", robots: { index: false } };

const EMAIL_PROVIDERS = new Set(["nodemailer", "resend"]);

type Params = Record<"provider" | "token" | "email" | "callbackUrl", string | string[] | undefined>;

/**
 * Sign-in emails land here instead of on the Auth.js callback. The one-time token is only spent when the form is
 * submitted, so anything that merely opens the link (mail scanners, previews) leaves it working.
 */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { provider, token, email, callbackUrl } = await searchParams;
  const valid = typeof provider === "string" && EMAIL_PROVIDERS.has(provider) && typeof token === "string" && typeof email === "string";

  if (!valid) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">This link is incomplete</h1>
        <p className="mb-8 text-sm text-muted">Open the link from your email again, or request a new one.</p>
        <Link href="/login" className={buttonClass("primary", "md", "w-full rounded-xl")}>
          Get a new sign-in link
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Sign in to Nystara</h1>
      <p className="mb-8 text-sm text-muted">
        Continue as <strong className="text-foreground">{email}</strong>.
      </p>
      <form method="get" action={`/api/auth/callback/${provider}`}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="email" value={email} />
        {typeof callbackUrl === "string" && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
        <button type="submit" className={buttonClass("primary", "md", "w-full rounded-xl")}>
          Continue
        </button>
      </form>
    </div>
  );
}
