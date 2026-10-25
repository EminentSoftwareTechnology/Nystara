import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import MfaChallenge from "@/components/security/MfaChallenge";
import { authIncludingPendingMfa } from "@/lib/auth";
import { mfaMethods } from "@/lib/mfa";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Verify it’s you" };
export const dynamic = "force-dynamic";

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeNext((await searchParams).next);
  const session = await authIncludingPendingMfa();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.mfaPending) redirect(next);

  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Verify it’s you</h1>
      <p className="mb-8 text-sm text-muted">
        Two-step verification is on for {session.user.email ?? "your account"}. Confirm this sign-in to continue.
      </p>
      <MfaChallenge
        methods={await mfaMethods(session.user.id)}
        optionsUrl="/api/auth/mfa/options"
        verifyUrl="/api/auth/mfa/verify"
        redirectTo={next}
      />
      <form action={signOutAction} className="mt-8 text-center">
        <button type="submit" className="text-sm text-muted underline underline-offset-4 hover:text-foreground">
          Cancel and sign out
        </button>
      </form>
    </div>
  );
}
