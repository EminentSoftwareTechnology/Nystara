import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { EMAIL_EVENTS, type EmailEvent } from "../lib/email/templates";

type Send = { to: string; event: EmailEvent; options: { theme?: string; unsubscribeUrl?: string } };
type User = { email: string; name: string; emailTheme: string; activityEmails: boolean };
type Notify = { notifyUser: (id: string, event: EmailEvent) => Promise<void>; notifyEmail: (email: string, event: "account-deleted") => Promise<void> };

function loadNotifications(user: User | null, sends: Send[], failure?: "database" | "delivery", errors: unknown[] = []): Notify {
  const source = readFileSync(new URL("../lib/email/notifications.ts", import.meta.url), "utf8");
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
  const exports = {};
  const require = createRequire(import.meta.url);
  const imports: Record<string, unknown> = {
    "../prisma": { prisma: { user: { findUnique: async () => { if (failure === "database") throw new Error("secret database credentials"); return user; } } } },
    "../theme": { isExplicitTheme: (value: string) => ["light", "dark", "sand"].includes(value) },
    "./templates": { EMAIL_EVENTS, appLink: (path: string) => `http://localhost${path}` },
    "./unsubscribe": { unsubscribeToken: async (id: string) => `signed-${id}` },
    "./send": { sendEmail: async (to: string, event: EmailEvent, options: Send["options"]) => { if (failure === "delivery") throw new Error("secret provider credentials"); sends.push({ to, event, options }); } },
  };
  runInNewContext(outputText, { exports, console: { error: (...args: unknown[]) => errors.push(args) }, require: (id: string) => id in imports ? imports[id] : require(id) });
  return exports as Notify;
}

const user: User = { email: "reader@example.test", name: "Reader", emailTheme: "sand", activityEmails: false };

for (const event of Object.keys(EMAIL_EVENTS) as EmailEvent[]) {
  test(`${event}: activity opt-out preserves essential delivery`, async () => {
    const sends: Send[] = [];
    const { notifyUser } = loadNotifications(user, sends);
    await notifyUser("owner", event);
    assert.equal(sends.length, EMAIL_EVENTS[event].category === "activity" ? 0 : 1);
    if (sends[0]) {
      assert.equal(sends[0].to, user.email);
      assert.equal(sends[0].options.theme, "sand");
      assert.equal(sends[0].options.unsubscribeUrl, undefined);
    }
  });
}

for (const emailTheme of ["light", "dark", "sand", "system", "invalid", ""]) {
  test(`saved theme ${emailTheme || "empty"} resolves to a supported theme`, async () => {
    const sends: Send[] = [];
    const { notifyUser } = loadNotifications({ ...user, emailTheme, activityEmails: true }, sends);
    await notifyUser("owner", "comment-received");
    assert.equal(sends[0].options.theme, ["light", "dark", "sand"].includes(emailTheme) ? emailTheme : "light");
    assert.equal(sends[0].options.unsubscribeUrl, "http://localhost/unsubscribe?token=signed-owner");
  });
}

test("deleted or unknown users receive no notification", async () => {
  const sends: Send[] = [];
  await loadNotifications(null, sends).notifyUser("missing", "passkey-added");
  assert.equal(sends.length, 0);
});

for (const failure of ["database", "delivery"] as const) {
  test(`${failure} failure never escapes or logs provider/database secrets`, async () => {
    const sends: Send[] = [];
    const errors: unknown[] = [];
    await loadNotifications(user, sends, failure, errors).notifyUser("owner", "totp-enabled");
    assert.equal(sends.length, 0);
    assert.equal(errors.length, 1);
    assert.ok(!JSON.stringify(errors).includes("credentials"));
    assert.ok(!JSON.stringify(errors).includes(user.email));
  });
}

test("account erasure confirmation can send after the user row disappears", async () => {
  const sends: Send[] = [];
  await loadNotifications(null, sends).notifyEmail(user.email, "account-deleted");
  assert.equal(sends[0].to, user.email);
  assert.equal(sends[0].event, "account-deleted");
});

test("account erasure delivery failure does not fail the completed deletion", async () => {
  const sends: Send[] = [];
  const errors: unknown[] = [];
  await loadNotifications(null, sends, "delivery", errors).notifyEmail(user.email, "account-deleted");
  assert.equal(sends.length, 0);
  assert.equal(errors.length, 1);
});
