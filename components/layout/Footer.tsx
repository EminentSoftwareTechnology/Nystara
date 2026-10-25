import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <Link href="/" className="flex items-center gap-2 font-bold text-lg mb-3">
              <svg width="22" height="22" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <rect width="28" height="28" rx="6" fill="#111827" />
                <path d="M7 9h14M7 14h10M7 19h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
              TechScribe
            </Link>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Long-form technical articles for software engineers.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-3 text-gray-900 dark:text-gray-100">Company</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li><Link href="/about" className="hover:text-gray-900 dark:hover:text-white">About</Link></li>
              <li><Link href="/contact" className="hover:text-gray-900 dark:hover:text-white">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-3 text-gray-900 dark:text-gray-100">Legal</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li><Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-gray-900 dark:hover:text-white">Terms of Service</Link></li>
              <li><Link href="/cookies" className="hover:text-gray-900 dark:hover:text-white">Cookie Policy</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-3 text-gray-900 dark:text-gray-100">Account</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li><Link href="/login" className="hover:text-gray-900 dark:hover:text-white">Sign in</Link></li>
              <li><Link href="/signup" className="hover:text-gray-900 dark:hover:text-white">Sign up</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-800 pt-6 text-sm text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} TechScribe. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
