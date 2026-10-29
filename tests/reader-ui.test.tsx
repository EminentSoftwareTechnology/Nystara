import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import Ribbon from "../components/editor/Ribbon";
import ShareBar from "../components/article/ShareBar";
import TrendingRail from "../components/article/TrendingRail";

const noop = () => undefined;

test("editor ribbon renders Word-style tabs, font tools and the styles gallery in the chosen theme", () => {
  const html = renderToStaticMarkup(
    <Ribbon editor={null} disabled={false} uploading={false} theme="bold" onTheme={noop} onInsertImage={noop}
      onUploadCover={noop} onToggleVideo={noop} onToggleLink={noop} videoOpen={false} alt="" onAlt={noop} pro />,
  );
  for (const label of ["home", "insert", "design", "Increase font size", "Numbering", "Heading 1", "Styles"])
    assert.ok(html.includes(label), label);
  assert.match(html, /data-story-theme="bold"/);
});

test("share bar links encode the story URL for each network", () => {
  const html = renderToStaticMarkup(<ShareBar url="https://nystara.test/a/b?x=1&y=2" title={'Hello "world"'} />);
  assert.match(html, /facebook\.com\/sharer\/sharer\.php\?u=https%3A%2F%2Fnystara\.test%2Fa%2Fb%3Fx%3D1%26y%3D2/);
  assert.match(html, /linkedin\.com\/sharing\/share-offsite\/\?url=https%3A%2F%2Fnystara\.test/);
  assert.match(html, /twitter\.com\/intent\/tweet\?url=.*text=Hello%20%22world%22/);
  for (const label of ["Share on Instagram", "Share on Discord", "Copy link"]) assert.ok(html.includes(label), label);
  assert.equal((html.match(/rel="noopener noreferrer"/g) ?? []).length, 3);
});

test("trending rail ranks stories and shows empty states", () => {
  const story = { id: "1", slug: "s", title: "A story", username: "maya", topic: "ai", views: 1200 };
  const html = renderToStaticMarkup(<TrendingRail trending={[story]} today={[story]} />);
  assert.match(html, /1 · Trending/);
  assert.match(html, /1\.2K reads/);
  assert.match(html, /href="\/maya\/s"/);
  const empty = renderToStaticMarkup(<TrendingRail trending={[]} today={[]} />);
  assert.match(empty, /Nothing is trending yet/);
  assert.match(empty, /No reads yet today/);
});
