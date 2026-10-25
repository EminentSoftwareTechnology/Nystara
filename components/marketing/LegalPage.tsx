import type { ReactNode } from "react";

/** Shared typography for long-form legal and informational pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-10 flex flex-col gap-3 border-b border-border pb-8">
        <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">{title}</h1>
        <p className="text-sm text-muted">Last updated {updated}</p>
      </header>
      <div className="flex flex-col gap-4 text-[15px] leading-7 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:pl-1 [&_p]:text-foreground/85 [&_table]:w-full [&_table]:text-sm [&_td]:border-b [&_td]:border-border [&_td]:py-2.5 [&_td]:pr-4 [&_td]:align-top [&_th]:border-b [&_th]:border-border [&_th]:py-2.5 [&_th]:pr-4 [&_th]:text-left [&_th]:font-medium [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}
