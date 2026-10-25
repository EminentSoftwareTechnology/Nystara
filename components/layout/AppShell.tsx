import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AppSidebar from "./AppSidebar";
import UserMenu from "./UserMenu";

type Props = {
  children: React.ReactNode;
  requireAuth?: boolean;
};

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default async function AppShell({ children, requireAuth = true }: Props) {
  const session = await auth();

  if (requireAuth && !session?.user?.id) {
    redirect("/login");
  }

  let dbUser: {
    username: string | null;
    name: string | null;
    avatarUrl: string | null;
  } | null = null;

  if (session?.user?.id) {
    dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { username: true, name: true, avatarUrl: true },
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-page text-foreground md:flex-row">
      <AppSidebar username={dbUser?.username ?? null} account={session?.user ? <UserMenu sidebar name={dbUser?.name ?? session.user.name ?? null} email={session.user.email ?? null} avatarUrl={dbUser?.avatarUrl ?? session.user.image ?? null} username={dbUser?.username ?? null} /> : null} />

      <div className="flex min-w-0 flex-1 flex-col md:ml-60">
        {/* Top right controls */}
        <header className="sticky top-0 z-30 flex items-center justify-end gap-3 px-6 py-3 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm">
          {session?.user ? (
            <>
              <Link
                href="/new-story"
                className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <PencilIcon />
                <span>Write</span>
              </Link>
              <button
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                aria-label="Notifications"
              >
                <BellIcon />
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
            >
              Sign in
            </Link>
          )}
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
