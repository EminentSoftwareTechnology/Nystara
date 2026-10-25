import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Wall } from "@/components/marketing/Wall";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-page lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 items-center px-5 sm:px-8">
          <Logo wordmark="h-9" />
        </header>
        <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="flex w-full justify-center">{children}</div>
        </main>
        <footer className="flex h-14 items-center justify-center gap-5 text-xs text-muted">
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/cookies" className="hover:text-foreground">Cookies</Link>
        </footer>
      </div>
      <aside aria-hidden className="hidden p-3 lg:block">
        <Wall id="auth-wall" variant={2} className="flex h-full flex-col justify-end p-10">
          <blockquote className="max-w-md rounded-2xl border border-border bg-page/90 p-7 backdrop-blur">
            <p className="font-display text-2xl leading-snug tracking-tight">
              “Writing is thinking. To write well is to think clearly.”
            </p>
            <footer className="mt-4 text-sm text-muted">David McCullough</footer>
          </blockquote>
        </Wall>
      </aside>
    </div>
  );
}
