import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="6" fill="#111827" />
            <path d="M7 9h14M7 14h10M7 19h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          TechScribe
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/about" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            About
          </Link>
          <Link href="/contact" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            Contact
          </Link>
          <Link href="/login" className="px-4 py-2 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors">
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
