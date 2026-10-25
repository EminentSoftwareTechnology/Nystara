"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOutAction } from "@/app/actions/auth";
import { BookIcon, BookmarkIcon, CloseIcon, GridIcon, HomeIcon, LogoutIcon, PenIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cx } from "@/components/ui";
import { Avatar } from "./Avatar";
import { type NavUser, activeHref, navSections } from "./nav";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/me/library", label: "Library", Icon: BookmarkIcon },
  { href: "/new-story", label: "Write", Icon: PenIcon },
  { href: "/me/stories", label: "Stories", Icon: BookIcon },
];

/** Bottom navigation for phones, tablets and the installed app, with a "More" sheet listing every destination. */
export default function MobileNav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sections = navSections(user.username);
  const active = activeHref(pathname, sections);
  const displayName = user.name ?? user.username ?? "Your account";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close the sheet after navigating
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const tabClass = (on: boolean) =>
    cx(
      "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
      on ? "text-foreground" : "text-muted",
    );

  return (
    <div className="hidden touch:block">
      <nav
        aria-label="Workspace"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-page/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto flex max-w-2xl px-2">
          {TABS.map(({ href, label, Icon }) => (
            <li key={href} className="flex flex-1">
              <Link href={href} aria-current={active === href ? "page" : undefined} className={tabClass(active === href)}>
                {href === "/new-story" ? (
                  <span className="flex h-8 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Icon size={18} />
                  </span>
                ) : (
                  <Icon size={22} strokeWidth={active === href ? 2.25 : 1.75} />
                )}
                {label}
              </Link>
            </li>
          ))}
          <li className="flex flex-1">
            <button
              type="button"
              aria-expanded={open}
              aria-controls="more-sheet"
              onClick={() => setOpen(true)}
              className={tabClass(open || (active !== null && !TABS.some((t) => t.href === active)))}
            >
              <GridIcon size={22} />
              More
            </button>
          </li>
        </ul>
      </nav>

      <div
        id="more-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="All destinations"
        inert={!open || undefined}
        className={cx("fixed inset-0 z-50 transition-[visibility] duration-300", open ? "visible" : "invisible")}
      >
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className={cx("absolute inset-0 bg-black/40 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
        />
        <div
          className={cx(
            "absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] max-w-2xl flex-col rounded-t-3xl border border-border bg-page shadow-2xl transition-transform duration-300 ease-out",
            open ? "translate-y-0" : "translate-y-full",
          )}
        >
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <Avatar src={user.avatarUrl} name={displayName} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              {user.email && <p className="truncate text-xs text-muted">{user.email}</p>}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {sections.map((section) => (
              <section key={section.title} className="mb-5">
                <h2 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{section.title}</h2>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {section.items.map(({ href, label, Icon }) => (
                    <li key={label}>
                      <Link
                        href={href}
                        aria-current={active === href ? "page" : undefined}
                        className={cx(
                          "flex h-20 flex-col items-center justify-center gap-2 rounded-2xl border text-xs font-medium transition-colors",
                          active === href ? "border-foreground bg-surface" : "border-border hover:bg-surface",
                        )}
                      >
                        <Icon size={20} />
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <div className="flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm">
              Theme
              <ThemeToggle />
            </div>
          </div>

          <form action={signOutAction} className="border-t border-border px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border text-sm font-medium hover:bg-surface"
            >
              <LogoutIcon size={18} />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
