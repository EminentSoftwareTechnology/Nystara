import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <header className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="6" fill="#111827" />
            <path d="M7 9h14M7 14h10M7 19h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          TechScribe
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </main>
      <footer className="h-12 flex items-center justify-center gap-4 text-xs text-gray-400">
        <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
        <Link href="/terms" className="hover:text-gray-600">Terms</Link>
        <Link href="/cookies" className="hover:text-gray-600">Cookies</Link>
      </footer>
    </div>
  );
}
