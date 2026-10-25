import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
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
    <footer className="mt-auto border-t border-border bg-page text-center lg:text-left">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="col-span-2 flex flex-col items-center gap-3 lg:col-span-1 lg:items-start">
          <Logo wordmark="h-14" />
          <p className="max-w-xs text-sm text-muted">
            Long-form writing that lasts. Read deep dives, publish your own stories and grow an audience.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col items-center gap-3 text-sm lg:items-start">
            <h2 className="text-muted">{column.title}</h2>
            {column.links.map(({ href, label }) => (
              <Link key={href} href={href} className="transition-colors hover:text-muted">
                {label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-6 text-xs text-muted sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <p>© {new Date().getFullYear()} Nystara. All rights reserved.</p>
          <FooterThemePicker />
        </div>
      </div>
    </footer>
  );
}
