import Image from "next/image";
import { cx } from "@/components/ui";

export function Avatar({ src, name, size = 36, className }: { src: string | null; name: string; size?: number; className?: string }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cx("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-sm font-semibold", className)}
    >
      {src ? (
        <Image src={src} alt="" width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{name.trim()[0]?.toUpperCase() ?? "U"}</span>
      )}
    </span>
  );
}
