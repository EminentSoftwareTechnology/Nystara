import AppShell from "@/components/layout/AppShell";
import Link from "next/link";

export default function HelpPage() {
  return (
    <AppShell>
      <div className="w-full px-6 py-8">
        <h1 className="text-3xl font-semibold">Writing on Nystara</h1>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {[
            [
              "Write and format",
              "Use headings, fonts, alignment, lists, quotes and code in the writing toolbar. Select a passage before applying formatting. Your writing is kept in this browser until you publish, so closing the tab won’t lose it. Save draft keeps it on your account; reopen it from Stories.",
            ],
            [
              "Images and videos",
              "Upload JPEG, PNG or WebP images up to 600 KB. Insert a public YouTube or Vimeo link to add a thumbnail preview. Readers choose when to load video playback.",
            ],
            [
              "Premium AI editor",
              "Open AI editor from the menu. Active members can request editorial feedback, titles, outlines and passage edits, then copy a suggestion or add it to their new story. AI and storage require administrator configuration.",
            ],
            [
              "Publish",
              "Add a title and story, optionally choose a cover and member-only access, then publish. Your published story keeps its document formatting.",
            ],
          ].map(([title, text]) => (
            <section
              key={title}
              className="rounded-xl border border-border p-6"
            >
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted">{text}</p>
            </section>
          ))}
        </div>
        <Link href="/new-story" className="mt-8 inline-block underline">
          Open your writing desk
        </Link>
      </div>
    </AppShell>
  );
}
