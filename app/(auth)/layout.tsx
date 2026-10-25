import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-page">
      <header className="h-16 flex items-center justify-center border-b border-border bg-page">
        <Logo wordmark="h-9" />
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </main>
      <footer className="h-12 flex items-center justify-center gap-4 text-xs text-muted">
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
        <Link href="/cookies" className="hover:text-foreground">Cookies</Link>
      </footer>
    </div>
  );
}
