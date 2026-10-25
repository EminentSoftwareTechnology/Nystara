import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass } from "@/components/ui";
import { authIncludingPendingMfa } from "@/lib/auth";

export const metadata: Metadata = { title: "Unable to sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Auth.js sends every sign-in failure here (pages.error) with an `error` code. */
export default async function SignInErrorPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;

  // A link that was already used, in a browser that is now signed in by it, just carries on.
  if (error === "Verification" && (await authIncludingPendingMfa())?.user) redirect("/mfa");

  const expired = error === "Verification";
  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Unable to sign in</h1>
      <p className="mb-8 text-sm text-muted">
        {expired
          ? "This sign-in link has already been used or has expired. Each link works once and lasts 24 hours."
          : "Something went wrong while signing you in. Please try again."}
      </p>
      <Link href="/login" className={buttonClass("primary", "md", "w-full rounded-xl")}>
        {expired ? "Get a new sign-in link" : "Back to sign in"}
      </Link>
    </div>
  );
}
