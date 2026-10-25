import type { ReactNode } from "react";

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
    <div className={`mb-10 flex flex-col gap-3 ${center ? "mx-auto max-w-2xl items-center text-center" : "max-w-2xl"}`}>
      <p className="text-sm text-muted">{eyebrow}</p>
      <h2 id={id} className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {title}
      </h2>
      {children && <p className="text-muted">{children}</p>}
    </div>
  );
}

/** Top-of-page intro for marketing pages. */
export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-4 pt-12 sm:px-6 sm:pt-20">
      <p className="text-sm text-muted">{eyebrow}</p>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      {children && <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">{children}</p>}
    </section>
  );
}
