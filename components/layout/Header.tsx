"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo, Wordmark } from "@/components/brand/Logo";
import { ArrowRightIcon, CloseIcon, MenuIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { buttonClass, cx } from "@/components/ui";

export const SITE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/why-blog", label: "Why blog" },
  { href: "/features", label: "Features" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Header({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close the mobile menu after navigating
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const button = trigger.current;
    panel.current?.focus();
    const desktop = window.matchMedia("(min-width: 64rem)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      button?.focus();
    };
  }, [open]);

  const primary = signedIn
    ? { href: "/new-story", label: "Write a story" }
    : { href: "/signup", label: "Start writing" };
  const secondary = signedIn
    ? { href: "/me/stories", label: "Your stories" }
    : { href: "/login", label: "Sign in" };

  return (
    <>
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-6 rounded-full border border-border bg-page/80 pl-5 pr-2 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.35)] backdrop-blur-md">
          <Logo wordmark="h-8 sm:h-9" />
          <nav aria-label="Site" className="hidden items-center gap-0.5 rounded-full bg-surface/70 p-1 lg:flex">
            {SITE_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className="rounded-full px-3.5 py-1.5 text-sm text-muted transition-colors hover:text-foreground aria-[current=page]:bg-page aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggle />
            <Link href={secondary.href} className={buttonClass("ghost", "sm")}>
              {secondary.label}
            </Link>
            <Link href={primary.href} className={buttonClass("primary", "sm")}>
              {primary.label}
            </Link>
          </div>
          <button
            ref={trigger}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background hover:bg-surface lg:hidden"
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      {/* Outside <header>: its backdrop filter would otherwise become the containing block for the fixed drawer. */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open || undefined}
        className={cx("fixed inset-0 z-50 transition-[visibility] duration-300 lg:hidden", open ? "visible" : "invisible")}
      >
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className={cx("absolute inset-0 bg-black/50 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
        />
        <div
          ref={panel}
          tabIndex={-1}
          className={cx(
            "absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col rounded-l-3xl border-l border-border bg-background shadow-2xl outline-none",
            "transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex h-16 shrink-0 items-center justify-between px-5">
            <Wordmark className="h-9" />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-2"
            >
              <CloseIcon />
            </button>
          </div>
          <nav aria-label="Site mobile" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
            {SITE_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className="flex min-h-13 items-center justify-between rounded-2xl px-4 text-lg font-medium transition-colors hover:bg-surface aria-[current=page]:bg-surface"
              >
                {label}
                <ArrowRightIcon size={16} className="text-muted" />
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-3 border-t border-border p-5">
            <div className="flex items-center justify-between text-sm text-muted">
              Theme
              <ThemeToggle />
            </div>
            <Link href={primary.href} className={buttonClass("primary", "lg", "w-full")}>
              {primary.label}
            </Link>
            <Link href={secondary.href} className={buttonClass("secondary", "lg", "w-full")}>
              {secondary.label}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
