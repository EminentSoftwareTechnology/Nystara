import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppSidebar from "./AppSidebar";
import MobileNav from "./MobileNav";

type Props = {
  children: React.ReactNode;
  requireAuth?: boolean;
};

export default async function AppShell({ children, requireAuth = true }: Props) {
  const session = await auth();

  if (requireAuth && !session?.user?.id) {
    redirect("/login");
  }

  const dbUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { username: true, name: true, avatarUrl: true },
      })
    : null;

  const user = session?.user
    ? {
        name: dbUser?.name ?? session.user.name ?? null,
        email: session.user.email ?? null,
        avatarUrl: dbUser?.avatarUrl ?? session.user.image ?? null,
        username: dbUser?.username ?? null,
      }
    : null;

  return (
    <div className="flex min-h-[calc(100dvh-4.25rem)] flex-col bg-page text-foreground">
      {user && <AppSidebar user={user} />}

      <div className={`flex min-w-0 flex-1 flex-col ${user ? "ml-64 touch:ml-0" : ""}`}>

        <main className={`flex-1 ${user ? "touch:pb-[calc(4.5rem+env(safe-area-inset-bottom))]" : ""}`}>{children}</main>
      </div>

      {user && <MobileNav user={user} />}
    </div>
  );
}
