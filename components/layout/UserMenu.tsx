"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";

type Props = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  username: string | null;
};

export default function UserMenu({ name, email, avatarUrl, username }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = (name ?? email ?? "U")[0].toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600 transition-all"
        aria-label="User menu"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={name ?? "User"}
            width={36}
            height={36}
            className="rounded-full object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-semibold text-gray-700 dark:text-gray-200">
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-2 z-50">
          {/* Profile row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={name ?? "User"} width={40} height={40} className="rounded-full object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{name ?? username}</div>
              {username && (
                <Link
                  href={`/${username}`}
                  className="text-xs text-green-600 hover:underline"
                  onClick={() => setOpen(false)}
                >
                  View profile
                </Link>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 my-1" />

          <Link href="/me/stories" onClick={() => setOpen(false)} className="flex items-center px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
            Stories
          </Link>
          <Link href="/me/stats" onClick={() => setOpen(false)} className="flex items-center px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
            Stats
          </Link>
          <Link href="/me/library" onClick={() => setOpen(false)} className="flex items-center px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
            Library
          </Link>

          <div className="border-t border-gray-100 dark:border-gray-800 my-1" />

          <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
            Settings
          </Link>
          <Link href="/help" onClick={() => setOpen(false)} className="flex items-center px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
            Help
          </Link>

          <div className="border-t border-gray-100 dark:border-gray-800 my-1" />

          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              Sign out
            </button>
          </form>
          {email && (
            <div className="px-4 py-1.5 text-xs text-gray-400 dark:text-gray-500 truncate">{email}</div>
          )}
        </div>
      )}
    </div>
  );
}
