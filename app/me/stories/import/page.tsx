import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ImportStory from "./ImportStory";

export default async function ImportStoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
        <p className="text-sm text-muted">Bring your words with you</p>
        <h1 className="mt-1 font-display text-4xl">Import a story</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          Upload a text or Markdown file, or paste your writing below.
          We&apos;ll create a private draft in the story editor so you can
          format, add images, and review it before publishing.
        </p>
        <ImportStory />
      </div>
    </AppShell>
  );
}
