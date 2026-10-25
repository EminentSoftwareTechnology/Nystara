export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:opacity-90",
  secondary: "border border-border-strong text-foreground hover:bg-surface-2",
  ghost: "text-foreground hover:bg-surface-2",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-6 text-base",
};

/** Shared by <button> and <Link> so both look identical. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export const CARD = "rounded-2xl border border-border bg-background";
/** A CARD that lifts slightly on hover, for grids of features or links. */
export const TILE = "rounded-2xl border border-border bg-background transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)]";
export const SECTION = "mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20";
export const LEARN = "text-sm underline decoration-border-strong underline-offset-4 hover:decoration-foreground";
export const INPUT =
  "min-h-11 w-full rounded-xl border border-border bg-page px-3.5 text-[15px] text-foreground placeholder:text-muted focus:border-border-strong focus:outline-none";
