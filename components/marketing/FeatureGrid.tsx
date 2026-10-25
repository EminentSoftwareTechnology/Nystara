import type { Feature } from "./features";
import { TILE } from "@/components/ui";

export function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {features.map(({ Icon, title, body }) => (
        <div key={title} className={`${TILE} flex flex-col gap-3 p-6`}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
            <Icon size={19} />
          </span>
          <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
          <p className="text-sm leading-6 text-muted">{body}</p>
        </div>
      ))}
    </div>
  );
}
