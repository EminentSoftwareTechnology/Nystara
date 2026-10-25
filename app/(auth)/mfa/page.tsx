import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import AccountSetup from "@/components/security/AccountSetup";
import MfaChallenge from "@/components/security/MfaChallenge";
import { authIncludingPendingMfa } from "@/lib/auth";
import { mfaMethods } from "@/lib/mfa";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Verify it’s you" };
export const dynamic = "force-dynamic";

type SearchParams = { next?: string | string[]; name?: string | string[] };

function SignOut() {
  return (
    <form action={signOutAction} className="mt-8 text-center">
      <button type="submit" className="text-sm text-muted underline underline-offset-4 hover:text-foreground">
        Cancel and sign out
      </button>
    </form>
  );
}

/** Every sign-in passes through here: verify an existing second factor, or set up name and second factor first. */
export default async function MfaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const session = await authIncludingPendingMfa();
  if (!session?.user?.id) redirect("/login");

  if (session.user.mfaPending) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="mb-1 font-display text-3xl tracking-tight">Verify it’s you</h1>
        <p className="mb-8 text-sm text-muted">
          Two-step verification is on for {session.user.email ?? "your account"}. Confirm this sign-in to continue.
        </p>
        <MfaChallenge
          methods={await mfaMethods(session.user.id)}
          optionsUrl="/api/auth/mfa/options"
          verifyUrl="/api/auth/mfa/verify"
          // Back here afterwards in case the account still needs its name.
          redirectTo={`/mfa?next=${encodeURIComponent(next)}`}
        />
        <SignOut />
      </div>
    );
  }

  if (!session.user.setupRequired) redirect(next);

  const currentName = session.user.name?.trim() ?? "";
  const linkName = typeof params.name === "string" ? params.name.trim().slice(0, 100) : "";
  return (
    <div className="w-full max-w-2xl">
      <h1 className="mb-1 font-display text-3xl tracking-tight sm:text-4xl">Finish setting up your account</h1>
      <p className="mb-10 text-sm text-muted">
        Signed in as {session.user.email}. Two quick steps keep your writing safe.
      </p>
      <AccountSetup needsName={!currentName} initialName={currentName || linkName} redirectTo={next} />
      <SignOut />
    </div>
  );
}
