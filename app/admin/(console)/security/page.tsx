import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SecuritySettings from "@/components/security/SecuritySettings";
import { getVerifiedAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Security" };
export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const session = await getVerifiedAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
      <p className="mt-1 mb-8 text-sm text-muted">
        Passkeys and two-step verification for {session.email}. With either on, the admin console asks for it after your password.
      </p>
      <SecuritySettings apiBase="/api/admin/security" />
    </div>
  );
}
