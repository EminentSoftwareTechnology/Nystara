import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BarChart,
  DonutChart,
  LineChart,
} from "../components/analytics/Charts";

test("empty analytics stay finite and expose real zero totals", () => {
  for (const chart of [
    <LineChart
      key="line"
      title="Views"
      points={[{ label: "2026-10-25", value: 0 }]}
    />,
    <BarChart key="bar" title="Stories" points={[]} />,
    <DonutChart
      key="donut"
      title="Portfolio"
      points={[{ label: "Published", value: 0 }]}
    />,
  ]) {
    const html = renderToStaticMarkup(chart);
    assert.doesNotMatch(html, /NaN|Infinity/);
    assert.match(html, /<figcaption/);
  }
});

test("daily analytics provide accessible exact counts and escape story titles", () => {
  const html = renderToStaticMarkup(
    <LineChart
      title="Views"
      points={[
        { label: "2026-10-24", value: 2 },
        { label: "2026-10-25", value: 11 },
      ]}
    />,
  );
  assert.match(html, /aria-label="Views: 13 in this period"/);
  assert.match(html, /<th scope="col">Date<\/th>/);
  assert.match(html, /<td>11<\/td>/);
  const bars = renderToStaticMarkup(
    <BarChart
      title="Top stories"
      points={[{ label: "<script>bad</script>", value: 5 }]}
    />,
  );
  assert.match(bars, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(bars, /<script>/);
});
