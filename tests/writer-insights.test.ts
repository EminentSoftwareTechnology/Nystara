import assert from "node:assert/strict";
import { test } from "node:test";
import { monthPoints, nextMilestone, weekdayPoints } from "../lib/writer-insights";

test("follower milestones always sit above the current count", () => {
  assert.equal(nextMilestone(0), 10);
  assert.equal(nextMilestone(10), 25);
  assert.equal(nextMilestone(9999), 10000);
  assert.equal(nextMilestone(10000), 20000);
});

test("weekday and month charts fill gaps with zeros", () => {
  const days = weekdayPoints([{ dow: 7, count: 4 }]);
  assert.equal(days.length, 7);
  assert.deepEqual(days[6], { label: "Sun", value: 4 });
  assert.equal(days[0].value, 0);
  const months = monthPoints([{ month: "2026-01", count: 2 }], 3, new Date("2026-02-15T00:00:00Z"));
  assert.deepEqual(months.map((m) => m.value), [0, 2, 0]);
  assert.match(months[0].label, /Dec 2025/);
});
