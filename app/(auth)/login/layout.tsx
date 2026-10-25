import { redirect } from "next/navigation";
import { authIncludingPendingMfa } from "@/lib/auth";

/** A sign-in that still owes its second factor or account setup continues at /mfa instead of starting over. */
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const session = await authIncludingPendingMfa();
  if (session?.user?.mfaPending || session?.user?.setupRequired) redirect("/mfa");
  return children;
}
