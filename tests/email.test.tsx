import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { EMAIL_EVENTS, EMAIL_THEMES, EMAIL_PALETTES, appLink, renderEmail, type EmailEvent } from "../lib/email/templates";
import { unsubscribeToken, unsubscribeUserId } from "../lib/email/unsubscribe";

process.env.NEXTAUTH_URL = "http://localhost:6100";
process.env.NEXTAUTH_SECRET = "email-test-secret-that-is-long-enough";

for (const theme of EMAIL_THEMES) {
  for (const event of Object.keys(EMAIL_EVENTS) as EmailEvent[]) {
    test(`${event} renders accessible HTML and text in ${theme}`, async () => {
      const content = EMAIL_EVENTS[event];
      const message = await renderEmail(event, { theme, name: '<img src=x onerror="alert(1)"> & Reader', detail: '<script>alert("x")</script>', unsubscribeUrl: content.category === "activity" ? "http://localhost:6100/unsubscribe?token=synthetic" : undefined });
      assert.equal(message.subject, content.subject);
      assert.match(message.html, /max-width:800px/);
      assert.match(message.html, new RegExp(EMAIL_PALETTES[theme].card));
      assert.match(message.html, new RegExp(`/brand/email/${theme}.png`));
      assert.match(message.html, /alt="Nystara orbital logo"/);
      assert.match(message.html, /&lt;script&gt;/);
      assert.doesNotMatch(message.html, /<script>|<img src=x/);
      assert.match(message.html, /<html[^>]+lang="en"/);
      for (const path of ["/contact", "/privacy", "/terms", "/settings/notifications"]) assert.ok(message.html.includes(`http://localhost:6100${path}`));
      assert.ok(message.text.includes("Nystara"));
      assert.ok(message.text.includes("http://localhost:6100"));
      assert.ok(message.html.length < 100_000, "Gmail clipping budget");
      assert.equal(message.html.includes("Unsubscribe from activity emails"), content.category === "activity");
      if (content.category === "essential") assert.match(message.text, /essential account or security message/);
    });
  }
}

test("sign-in preserves scanner-safe verification URL and token in HTML and text", async () => {
  const actionUrl = "http://localhost:6100/verify?token=one-time&provider=nodemailer&callbackUrl=%2Fmfa";
  const message = await renderEmail("sign-in", { actionUrl });
  assert.match(message.html, /\/verify\?token=one-time&amp;provider=nodemailer/);
  assert.ok(message.text.includes("/verify?token=one-time"));
  assert.match(message.text, /24 hours/);
});

test("welcome explains account setup, working features and premium AI limits with local links", async () => {
  const message = await renderEmail("welcome");
  for (const path of ["/mfa", "/settings", "/me/library", "/me/following", "/settings/notifications", "/new-story", "/me/stories", "/ai-editor", "/me/stats", "/me/security"]) {
    assert.ok(message.html.includes(`http://localhost:6100${path}`), path);
  }
  for (const text of ["Save draft", "recovery codes", "reading history", "premium access", "Export your account data"]) assert.ok(message.text.includes(text), text);
  const security = await renderEmail("passkey-added");
  assert.ok(!security.text.includes("Build your library"));
});

test("email actions reject external, protocol-relative and unsafe links", async () => {
  for (const path of ["https://evil.test", "//evil.test", "javascript:alert(1)", "/\\evil.test"]) {
    assert.throws(() => appLink(path));
    await assert.rejects(renderEmail("welcome", { actionPath: path }));
  }
});

test("unsubscribe tokens are opaque, purpose-bound, signed and expiring", async () => {
  const token = await unsubscribeToken("user-one");
  assert.equal(await unsubscribeUserId(token), "user-one");
  assert.equal(await unsubscribeUserId(token.slice(0, -5) + "abcde"), null);
  assert.equal(await unsubscribeUserId(""), null);
  const key = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
  for (const [purpose, audience, expiration] of [["session", "nystara:email", "1d"], ["activity-unsubscribe", "nystara:admin", "1d"], ["activity-unsubscribe", "nystara:email", "-1s"]]) {
    const other = await new SignJWT({ purpose }).setProtectedHeader({ alg: "HS256" }).setSubject("user-one").setAudience(audience).setExpirationTime(expiration).sign(key);
    assert.equal(await unsubscribeUserId(other), null);
  }
});
