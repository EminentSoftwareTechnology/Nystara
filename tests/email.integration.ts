import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const base = process.env.TEST_EMAIL_APP_URL;
const database = process.env.TEST_DATABASE_URL;
const mailpit = process.env.TEST_MAILPIT_URL ?? "http://127.0.0.1:8035";

test("live email flow: authentication, saved theme, signed unsubscribe and essential delivery in Mailpit", { skip: !base, timeout: 120_000 }, async () => {
  assert.ok(database && /_test$/.test(new URL(database).pathname), "Use an isolated *_test database");
  for (const url of [base!, mailpit]) assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Local services only");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: database }) });
  const email = `email-qa-${randomUUID()}@nystara.test`;
  const user = await prisma.user.create({ data: { email, name: "Email QA", username: `email-qa-${randomUUID()}`, mfaEnabled: true } });
  const sessionToken = randomUUID();
  await prisma.session.create({ data: { userId: user.id, sessionToken, expires: new Date(Date.now() + 3600_000), mfaVerifiedAt: new Date() } });
  const cookie = `authjs.session-token=${sessionToken}`;
  async function request(path: string, method = "GET", body?: object, signedIn = true) {
    return fetch(`${base}${path}`, { method, headers: { origin: base!, ...(signedIn ? { cookie } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: "manual" });
  }
  type CapturedMessage = { ID: string; To: { Address: string }[] };
  type Message = { ID: string; Subject: string; HTML: string; Text: string };
  async function messages(): Promise<Message[]> {
    const response = await fetch(`${mailpit}/api/v1/messages?limit=500`);
    assert.ok(response.ok);
    const data = await response.json() as { messages: CapturedMessage[] };
    return Promise.all(data.messages.filter((message) => message.To.some((to) => to.Address === email)).map(async (message) => {
      const detail = await fetch(`${mailpit}/api/v1/message/${message.ID}`);
      return await detail.json() as Message;
    }));
  }
  try {
    assert.equal((await request("/api/me/notifications", "PATCH", { emailTheme: "sand", activityEmails: true }, false)).status, 401);
    assert.equal((await request("/api/me/notifications", "PATCH", { emailTheme: "sand", activityEmails: true })).status, 200);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(saved.emailTheme, "sand");
    assert.equal((await request("/api/auth/magic-link", "POST", { intent: "login", email, turnstileToken: "local-development-only" }, false)).status, 200);
    const signIn = (await messages()).find((message) => message.Subject === "Your Nystara sign-in link");
    assert.ok(signIn);
    assert.ok(signIn.HTML.includes("/verify?"));
    assert.ok(signIn.HTML.includes("/brand/email/sand.png"));
    const article = await prisma.article.create({ data: { title: "Email integration fixture", slug: "email-fixture", authorId: user.id, content: { text: "Synthetic content" }, contentText: "Synthetic content", readTime: 1 } });
    assert.equal((await request(`/api/articles/${article.id}/publish`, "POST", { published: true })).status, 200);
    const published = (await messages()).find((message) => message.Subject === "Your story is live on Nystara");
    assert.ok(published);
    assert.ok(published.HTML.includes("/brand/email/sand.png"));
    assert.ok(published.Text.includes("Unsubscribe from activity emails"));
    const raw = await fetch(`${mailpit}/api/v1/message/${published.ID}/raw`).then((response) => response.text());
    assert.match(raw, /List-Unsubscribe-Post: List-Unsubscribe=One-Click/i);
    assert.match(raw, /List-Unsubscribe:/i);
    const unsubscribeUrl = published.HTML.match(/href="([^"]+\/unsubscribe\?token=[^"]+)"/)?.[1].replaceAll("&amp;", "&");
    assert.ok(unsubscribeUrl);
    assert.equal((await fetch(unsubscribeUrl)).status, 200);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).activityEmails, true, "GET must not unsubscribe");
    assert.equal((await fetch(`${base}/unsubscribe?token=invalid`, { method: "POST" })).status, 400);
    for (let count = 0; count < 2; count++) assert.equal((await fetch(unsubscribeUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" })).status, 200);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).activityEmails, false);
    const before = (await messages()).length;
    assert.equal((await request(`/api/articles/${article.id}/publish`, "POST", { published: false })).status, 200);
    assert.equal((await messages()).length, before, "Activity delivery must stop after unsubscribe");
    assert.equal((await request("/api/me", "PATCH", { name: "Email QA Updated" })).status, 200);
    const profile = (await messages()).find((message) => message.Subject === "Your Nystara profile was updated");
    assert.ok(profile, "Essential account delivery must continue");
    assert.ok(profile.HTML.includes("/brand/email/sand.png"));
    assert.equal((await fetch(`${mailpit}/api/v1/message/${profile.ID}/raw`).then((response) => response.text())).includes("List-Unsubscribe:"), false);
    for (const path of ["/contact", "/privacy", "/terms", "/settings/notifications", "/brand/email/light.png", "/brand/email/dark.png", "/brand/email/sand.png"]) assert.equal((await request(path)).status, 200, path);
    console.log("Mailpit verified: branded sign-in, activity email + one-click headers, GET safety, POST unsubscribe, suppression and essential delivery.");
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
