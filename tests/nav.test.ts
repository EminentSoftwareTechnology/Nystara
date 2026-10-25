import assert from "node:assert/strict";
import { test } from "node:test";
import { activeHref, navSections } from "../components/layout/nav";
import { localDraftKey } from "../lib/local-draft";

test("workspace navigation highlights the most specific destination", () => {
  const sections = navSections("ada");
  assert.equal(activeHref("/", sections), "/");
  assert.equal(activeHref("/me/following", sections), "/me/following");
  assert.equal(activeHref("/me/following/suggestions", sections), "/me/following/suggestions");
  assert.equal(activeHref("/ada", sections), "/ada");
  assert.equal(activeHref("/ada/some-story", sections), "/ada");
  assert.equal(activeHref("/new-story", sections), "/new-story");
  assert.equal(activeHref("/unknown", sections), null);
});

test("every signed-in feature is listed in the navigation", () => {
  const hrefs = navSections(null).flatMap((s) => s.items.map((i) => i.href));
  for (const href of ["/ai-editor", "/settings", "/me/audience", "/me/help", "/me/security", "/me/stats"]) {
    assert.ok(hrefs.includes(href), href);
  }
});

test("browser drafts are kept per account and per story", () => {
  assert.notEqual(localDraftKey("a@example.com", null), localDraftKey("b@example.com", null));
  assert.notEqual(localDraftKey("a@example.com", null), localDraftKey("a@example.com", "story-1"));
});
