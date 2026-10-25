import type { ReactNode } from "react";
import { Wall } from "./Wall";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-page/80 px-3 py-1 text-xs font-medium text-muted">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-foreground" />
      {children}
    </p>
  );
}

export function Heading({
  eyebrow,
  id,
  title,
  children,
  center = false,
}: {
  eyebrow: string;
  id: string;
  title: string;
  children?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`mb-10 flex flex-col gap-4 ${center ? "mx-auto max-w-2xl items-center text-center" : "max-w-2xl"}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {children && <p className="leading-7 text-muted">{children}</p>}
    </div>
  );
}

/** Top-of-page intro for marketing pages: a framed band with the landscape behind it. */
export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10">
      <Wall id={`intro-${eyebrow.toLowerCase().replace(/\W+/g, "-")}`} variant={1} className="px-6 py-14 sm:px-12 sm:py-20">
        <div className="flex max-w-3xl flex-col gap-5">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-tight text-balance sm:text-6xl">{title}</h1>
          {children && <p className="max-w-2xl text-lg leading-8 text-foreground/75">{children}</p>}
        </div>
      </Wall>
    </section>
  );
}
