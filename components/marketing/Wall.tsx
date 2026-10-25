import type { ReactNode } from "react";
import { cx } from "@/components/ui";

const HILLS = {
  far: "M0 400 L110 350 L210 395 L350 290 L500 385 L650 320 L810 405 L970 330 L1200 420 V700 H0Z",
  mid: "M0 500 C150 440 300 470 450 500 S750 545 900 490 S1100 450 1200 480 V700 H0Z",
  near: "M0 585 C200 540 380 600 600 568 S1000 540 1200 590 V700 H0Z",
};

/** Decorative landscape behind featured content. Colours come from the `--wall-*` tokens, so it follows the theme. */
export function Wall({
  id,
  variant = 0,
  className,
  children,
}: {
  id: string;
  variant?: 0 | 1 | 2;
  className?: string;
  children?: ReactNode;
}) {
  const flip = variant === 1;
  const sunX = [880, 260, 600][variant];
  return (
    <div className={cx("relative isolate overflow-hidden rounded-2xl border border-border", className)}>
      <svg
        aria-hidden
        focusable="false"
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 -z-10 h-full w-full"
      >
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--wall-c)" />
            <stop offset="0.55" stopColor="var(--wall-b)" />
            <stop offset="1" stopColor="var(--wall-a)" />
          </linearGradient>
          <radialGradient id={`${id}-sun`} cx={sunX} cy="250" r="360" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--wall-b)" stopOpacity="0.95" />
            <stop offset="1" stopColor="var(--wall-b)" stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={variant + 3} />
            <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.09 0" />
          </filter>
        </defs>
        <rect width="1200" height="700" fill={`url(#${id}-sky)`} />
        <rect width="1200" height="700" fill={`url(#${id}-sun)`} />
        <g transform={flip ? "translate(1200 0) scale(-1 1)" : undefined}>
          <path d={HILLS.far} fill="var(--wall-ink)" opacity="0.28" />
          <path d={HILLS.mid} fill="var(--wall-ink)" opacity="0.48" transform={variant === 2 ? "translate(0 -30)" : undefined} />
          <path d={HILLS.near} fill="var(--wall-ink)" opacity="0.7" />
        </g>
        <rect width="1200" height="700" filter={`url(#${id}-grain)`} />
      </svg>
      {children}
    </div>
  );
}
