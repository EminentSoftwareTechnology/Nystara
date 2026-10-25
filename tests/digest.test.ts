import assert from "node:assert/strict";
import { test } from "node:test";

import { digestToken, isDigestDue, readDigestToken } from "../lib/digest";

process.env.NEXTAUTH_SECRET ??= "test-secret-test-secret-test-secret";

test("digests are due once per period, with slack for an early scheduler", () => {
  const now = new Date("2026-10-25T09:00:00Z");
  const ago = (hours: number) => new Date(now.getTime() - hours * 3600_000);
  assert.equal(isDigestDue("DAILY", null, now), true);
  assert.equal(isDigestDue("DAILY", ago(23.9), now), true);
  assert.equal(isDigestDue("DAILY", ago(2), now), false);
  assert.equal(isDigestDue("WEEKLY", ago(24 * 6), now), false);
  assert.equal(isDigestDue("WEEKLY", ago(24 * 6.9), now), true);
  assert.equal(isDigestDue("MONTHLY", ago(24 * 20), now), false);
  assert.equal(isDigestDue("MONTHLY", ago(24 * 29.9), now), true);
});

test("digest tokens only work for their own purpose", async () => {
  const confirm = await digestToken("digest-confirm", "sub_1", "DAILY");
  assert.deepEqual(await readDigestToken("digest-confirm", confirm), { subscriberId: "sub_1", frequency: "DAILY" });
  assert.equal(await readDigestToken("digest-unsubscribe", confirm), null);
  assert.equal(await readDigestToken("digest-confirm", confirm + "x"), null);
  const leave = await digestToken("digest-unsubscribe", "sub_1");
  assert.deepEqual(await readDigestToken("digest-unsubscribe", leave), { subscriberId: "sub_1", frequency: undefined });
});
