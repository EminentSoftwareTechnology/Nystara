import { CARD } from "@/components/ui";

export type ChartPoint = { label: string; value: number };

export function LineChart({
  title,
  points,
}: {
  title: string;
  points: ChartPoint[];
}) {
  const max = Math.max(1, ...points.map((point) => point.value));
  const coords = points
    .map(
      (point, index) =>
        `${40 + (index / Math.max(1, points.length - 1)) * 520},${170 - (point.value / max) * 140}`,
    )
    .join(" ");
  return (
    <figure className={`${CARD} p-5 sm:p-6`}>
      <figcaption className="font-semibold">{title}</figcaption>
      <p className="mt-1 text-xs text-muted">Daily totals · UTC</p>
      <svg
        role="img"
        aria-label={`${title}: ${points.reduce((sum, point) => sum + point.value, 0)} in this period`}
        viewBox="0 0 600 210"
        className="mt-4 w-full text-foreground"
      >
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1="40"
              x2="560"
              y1={170 - fraction * 140}
              y2={170 - fraction * 140}
              stroke="var(--border)"
            />
            <text
              x="30"
              y={174 - fraction * 140}
              textAnchor="end"
              fontSize="10"
              fill="var(--muted)"
            >
              {Math.round(fraction * max)}
            </text>
          </g>
        ))}
        <polygon
          points={`40,170 ${coords} 560,170`}
          fill="currentColor"
          opacity="0.06"
        />
        <polyline
          points={coords}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {[0, Math.floor((points.length - 1) / 2), points.length - 1].map(
          (index) => (
            <text
              key={index}
              x={40 + (index / Math.max(1, points.length - 1)) * 520}
              y="195"
              fontSize="10"
              textAnchor="middle"
              fill="var(--muted)"
            >
              {points[index]?.label}
            </text>
          ),
        )}
      </svg>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer">View chart data</summary>
        <div className="mt-3 max-h-48 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.label}>
                  <th scope="row" className="py-1 font-normal">
                    {point.label}
                  </th>
                  <td>{point.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function BarChart({
  title,
  points,
}: {
  title: string;
  points: ChartPoint[];
}) {
  const max = Math.max(1, ...points.map((point) => point.value));
  return (
    <figure className={`${CARD} p-5 sm:p-6`}>
      <figcaption className="font-semibold">{title}</figcaption>
      <div className="mt-5 space-y-4">
        {points.length ? (
          points.map((point) => (
            <div key={point.label}>
              <div className="mb-1.5 flex justify-between gap-4 text-xs">
                <span className="truncate">{point.label}</span>
                <span>{point.value.toLocaleString()}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(point.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="py-12 text-sm text-muted">
            Publish a story to start seeing results.
          </p>
        )}
      </div>
    </figure>
  );
}

export function DonutChart({
  title,
  points,
}: {
  title: string;
  points: ChartPoint[];
}) {
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const colors = ["#0f766e", "#6366f1", "#d97706", "#db2777", "#64748b"];
  return (
    <figure className={`${CARD} p-5 sm:p-6`}>
      <figcaption className="font-semibold">{title}</figcaption>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-7">
        <svg
          role="img"
          aria-label={`${title}: ${total} total`}
          viewBox="0 0 120 120"
          className="h-36 w-36"
        >
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth="16"
          />
          {points.map((point, index) => {
            const share = total ? (point.value / total) * 100 : 0;
            const start = total
              ? (points
                  .slice(0, index)
                  .reduce((sum, entry) => sum + entry.value, 0) /
                  total) *
                100
              : 0;
            return (
              <circle
                key={point.label}
                cx="60"
                cy="60"
                r="45"
                pathLength="100"
                fill="none"
                stroke={colors[index % colors.length]}
                strokeWidth="16"
                strokeDasharray={`${share} ${100 - share}`}
                strokeDashoffset={-start}
                transform="rotate(-90 60 60)"
              />
            );
          })}
          <text
            x="60"
            y="65"
            textAnchor="middle"
            fill="var(--foreground)"
            fontSize="20"
          >
            {total}
          </text>
        </svg>
        <ul className="space-y-3 text-sm">
          {points.map((point, index) => (
            <li key={point.label} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="text-muted">{point.label}</span>
              <strong className="ml-2">{point.value}</strong>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
