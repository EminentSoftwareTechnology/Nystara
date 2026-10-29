import { cx } from "@/components/ui";

export default function ProBadge({ className }: { className?: string }) {
  return (
    <span
      title="Nystara Pro member"
      className={cx(
        "inline-flex items-center rounded-full bg-amber-300 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-black",
        className,
      )}
    >
      Pro
    </span>
  );
}
