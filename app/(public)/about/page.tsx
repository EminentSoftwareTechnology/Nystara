import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold mb-6">About TechScribe</h1>
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
        TechScribe is a platform for long-form technical writing by and for software engineers.
        We believe the best technical knowledge is written thoughtfully — not in 280 characters,
        but in the depth a hard problem deserves.
      </p>

      <h2 className="text-2xl font-semibold mb-4">Our mission</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
        To give engineers a home for writing that matters: architecture decisions, hard-won lessons,
        deep dives into algorithms, war stories from production. Content that engineers bookmark and
        return to months later.
      </p>

      <h2 className="text-2xl font-semibold mb-4">For writers</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
        TechScribe gives you a clean writing environment and a focused audience. Publish publicly or
        behind a member paywall. Your writing belongs to you.
      </p>

      <h2 className="text-2xl font-semibold mb-4">For readers</h2>
      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
        Free articles are always free. Become a member to access premium content and support the
        writers who spend hours crafting articles that advance your craft.
      </p>
    </div>
  );
}
