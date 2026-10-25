const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/** The next follower goal above the current count. */
export function nextMilestone(count: number): number {
  return (
    MILESTONES.find((goal) => goal > count) ??
    (Math.floor(count / 10000) + 1) * 10000
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Fills ISO weekdays (1 = Monday) so every day appears, even with no views. */
export function weekdayPoints(rows: { dow: number; count: number }[]) {
  return WEEKDAYS.map((label, index) => ({
    label,
    value: rows.find((row) => row.dow === index + 1)?.count ?? 0,
  }));
}

/** The last `months` calendar months (UTC), oldest first, as YYYY-MM keys. */
export function monthPoints(
  rows: { month: string; count: number }[],
  months: number,
  now = new Date(),
) {
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - index), 1),
    );
    const key = date.toISOString().slice(0, 7);
    return {
      label: date.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }),
      value: rows.find((row) => row.month === key)?.count ?? 0,
    };
  });
}
