import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/brand/Logo";
import { BellIcon, PenIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui";
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
    <div className="flex min-h-dvh flex-col bg-page text-foreground">
      {user && <AppSidebar user={user} />}

      <div className={`flex min-w-0 flex-1 flex-col ${user ? "ml-64 touch:ml-0" : ""}`}>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-page/90 px-4 backdrop-blur sm:px-6">
          <span className={user ? "hidden touch:inline-flex" : "inline-flex"}>
            <Logo wordmark="h-7" />
          </span>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <Link href="/new-story" className={buttonClass("ghost", "sm", "touch:hidden")}>
                  <PenIcon size={16} />
                  Write
                </Link>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
                  aria-label="Notifications"
                >
                  <BellIcon size={19} />
                </button>
              </>
            ) : (
              <Link href="/login" className={buttonClass("primary", "sm")}>
                Sign in
              </Link>
            )}
          </div>
        </header>

        <main className={`flex-1 ${user ? "touch:pb-[calc(4.5rem+env(safe-area-inset-bottom))]" : ""}`}>{children}</main>
      </div>

      {user && <MobileNav user={user} />}
    </div>
  );
}
