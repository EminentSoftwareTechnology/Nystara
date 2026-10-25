import Link from "next/link";
import { cx } from "@/components/ui";

const THEMES = ["light", "dark", "sand"] as const;

/* Plain <img>: SVGs are served unoptimized anyway. All three are in the markup; globals.css shows the one
   matching the active theme, and lazy loading keeps the hidden ones from being fetched. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="Nystara" className={cx("inline-block aspect-[1540/360] shrink-0", className ?? "h-9")}>
      {THEMES.map((theme) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={theme}
          src={`/brand/logos/${theme}/nystara-${theme}.svg`}
          alt=""
          width={1540}
          height={360}
          loading="lazy"
          decoding="async"
          className={`theme-${theme}-only h-full w-full`}
        />
      ))}
    </span>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cx("inline-flex h-7 w-7 shrink-0 items-center justify-center", className)}>
      {THEMES.map((theme) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={theme}
          src={`/brand/mark/${theme}/icon-transparent.svg`}
          alt=""
          width={512}
          height={512}
          loading="lazy"
          decoding="async"
          className={`theme-${theme}-only h-full w-full`}
        />
      ))}
    </span>
  );
}

export function Logo({ href = "/", className, wordmark }: { href?: string; className?: string; wordmark?: string }) {
  return (
    <Link href={href} className={cx("inline-flex items-center", className)}>
      <Wordmark className={wordmark} />
    </Link>
  );
}
