import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import SecuritySettings from "@/components/security/SecuritySettings";

export const metadata: Metadata = { title: "Security" };
export const dynamic = "force-dynamic";

export default function SecurityPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Security</h1>
        <p className="mt-2 mb-8 text-sm text-muted">Passkeys and two-step verification for your Nystara account.</p>
        <SecuritySettings apiBase="/api/me/security" />
      </div>
    </AppShell>
  );
}
