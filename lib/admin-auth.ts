import { getAdminSession, type AdminPayload } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

// The JWT alone stays valid for 8h; re-checking the DB means demoted or
// deleted admins lose access on their next request.
export async function isActiveAdmin(session: AdminPayload): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { email: true, role: true },
  });
  return !!user && user.role === "ADMIN" && user.email === session.email;
}

export async function getVerifiedAdminSession(): Promise<AdminPayload | null> {
  const session = await getAdminSession();
  if (!session || session.role !== "ADMIN") return null;
  return (await isActiveAdmin(session)) ? session : null;
}
