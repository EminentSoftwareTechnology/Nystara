import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ArrowRightIcon } from "@/components/icons";
import { FooterThemePicker } from "@/components/theme/FooterThemePicker";

const COLUMNS = [
  {
    title: "Blog",
    links: [
      { href: "/", label: "Home" },
      { href: "/why-blog", label: "Why blog" },
      { href: "/features", label: "Features" },
      { href: "/new-story", label: "Write a story" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/signup", label: "Create an account" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/cookies", label: "Cookie policy" },
    ],
  },
];

/** Centred on phones and tablets; a left-aligned grid from the desktop breakpoint up. */
export default function Footer() {
  return (
    <footer className="mt-auto px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl bg-accent text-accent-foreground">
        <div className="flex flex-col items-center gap-6 px-6 py-14 text-center sm:py-16">
          <h2 className="max-w-2xl font-display text-3xl font-medium tracking-tight text-balance sm:text-5xl">
            Your next story deserves a home that lasts.
          </h2>
          <p className="max-w-md text-sm opacity-75">Free to join. No password to remember. Your writing stays yours.</p>
          <Link
            href="/signup"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-accent-foreground px-6 font-medium text-accent transition-opacity hover:opacity-90"
          >
            Start writing <ArrowRightIcon size={16} />
          </Link>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-10 px-2 py-14 text-center sm:px-4 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:text-left">
        <div className="col-span-2 flex flex-col items-center gap-3 lg:col-span-1 lg:items-start">
          <Logo wordmark="h-12" />
          <p className="max-w-xs text-sm leading-6 text-muted">
            Long-form writing that lasts. Read deep dives, publish your own stories and grow an audience.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col items-center gap-3 text-sm lg:items-start">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{column.title}</h2>
            {column.links.map(({ href, label }) => (
              <Link key={href} href={href} className="transition-colors hover:text-muted">
                {label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 border-t border-border px-2 py-6 text-xs text-muted sm:px-4 lg:flex-row lg:justify-between">
        <p>© {new Date().getFullYear()} Nystara. All rights reserved.</p>
        <FooterThemePicker />
      </div>
    </footer>
  );
}
