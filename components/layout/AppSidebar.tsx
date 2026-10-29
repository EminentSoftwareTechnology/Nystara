"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import { LogoutIcon } from "@/components/icons";
import { cx } from "@/components/ui";
import { Avatar } from "./Avatar";
import { type NavUser, activeHref, navSections } from "./nav";

/** Desktop workspace navigation. Every destination is listed plainly; phones, tablets and the app use MobileNav. */
export default function AppSidebar({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const sections = navSections(user.username);
  const active = activeHref(pathname, sections);
  const displayName = user.name ?? user.username ?? "Your account";

  return (
    <aside className="fixed bottom-0 left-0 top-[4.25rem] z-40 flex w-64 flex-col border-r border-border bg-page touch:hidden">

      <nav aria-label="Workspace" className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 pb-6 pt-6">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{section.title}</p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map(({ href, label, Icon }) => (
                <li key={label}>
                  <Link
                    href={href}
                    aria-current={active === href ? "page" : undefined}
                    className={cx(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                      active === href ? "bg-surface font-medium text-foreground" : "text-muted hover:bg-surface hover:text-foreground",
                    )}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-2 border-t border-border p-3">
        <Link href="/settings" className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface">
          <Avatar src={user.avatarUrl} name={displayName} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{displayName}</span>
            {user.email && <span className="block truncate text-xs text-muted">{user.email}</span>}
          </span>
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <LogoutIcon size={18} />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
