"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cx } from "@/components/ui";

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
      {children}
    </svg>
  );
}

const navItems = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: (
      <Icon>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </Icon>
    ),
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: (
      <Icon>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
      </Icon>
    ),
  },
  {
    href: "/admin/articles",
    label: "Articles",
    icon: (
      <Icon>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8" />
      </Icon>
    ),
  },
  {
    href: "/admin/security",
    label: "Security",
    icon: (
      <Icon>
        <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" />
        <path d="m9 12 2 2 4-4" />
      </Icon>
    ),
  },
  {
    href: "/admin/profile",
    label: "Profile",
    icon: (
      <Icon>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </Icon>
    ),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </Icon>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <aside className="sticky top-0 z-30 flex shrink-0 flex-col border-b border-border bg-background md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex h-16 items-center justify-between gap-3 px-5 md:border-b md:border-border">
        <Logo href="/admin/dashboard" wordmark="h-8" />
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted">Admin</span>
      </div>

      <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-y-auto md:py-4">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex shrink-0 items-center gap-3 rounded-full px-3.5 py-2 text-sm font-medium transition-colors md:rounded-xl",
                active ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface hover:text-foreground",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="shrink-0 rounded-full px-3.5 py-2 text-sm font-medium text-muted hover:bg-surface hover:text-foreground disabled:opacity-50 md:hidden"
        >
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </nav>

      <div className="hidden flex-col gap-3 border-t border-border p-4 md:flex">
        <div className="flex items-center justify-between text-xs text-muted">
          Theme
          <ThemeToggle />
        </div>
        <Link href="/" className="rounded-xl px-3.5 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground">
          View site
        </Link>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-3 rounded-xl px-3.5 py-2 text-left text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
        >
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
