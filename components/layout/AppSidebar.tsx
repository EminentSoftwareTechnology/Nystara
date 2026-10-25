"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";

type Props = {
  username: string | null;
};

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V21H3V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function StoriesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function FollowingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 19c0-3.3 3.1-6 7-6s7 2.7 7 6" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function SecurityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

const navItems = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/me/library", label: "Library", Icon: LibraryIcon },
  { href: "/profile", label: "Profile", Icon: ProfileIcon },
  { href: "/me/stories", label: "Stories", Icon: StoriesIcon },
  { href: "/me/stats", label: "Stats", Icon: StatsIcon },
  { href: "/me/security", label: "Security", Icon: SecurityIcon },
];

export default function AppSidebar({ username }: Props) {
  const pathname = usePathname();

  const profileHref = username ? `/${username}` : "/profile";

  const resolvedNavItems = navItems.map((item) =>
    item.href === "/profile" ? { ...item, href: profileHref } : item
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 flex-shrink-0">
        <Logo wordmark="h-8" />
      </div>

      {/* Search */}
      <div className="px-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 rounded-full px-3 py-2">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search"
            className="bg-transparent text-sm outline-none w-full text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="space-y-0.5">
          {resolvedNavItems.map(({ href, label, Icon }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-900"
                }`}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Following section */}
        <div className="mt-6 px-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Following
          </p>
          <Link
            href="/me/following"
            className={`flex items-center gap-3 px-0 py-2.5 text-sm font-medium transition-colors ${
              pathname === "/me/following"
                ? "text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <FollowingIcon />
            Following
          </Link>
          <div className="mt-4 space-y-3">
            <Link
              href="/me/following/suggestions"
              className="flex items-start gap-3 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M5 1v8M1 5h8" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" />
                </svg>
              </span>
              <span>Find writers and publications to follow.</span>
            </Link>
            <Link
              href="/me/following/suggestions"
              className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors ml-8"
            >
              See suggestions
            </Link>
          </div>
        </div>
      </nav>
    </aside>
  );
}
