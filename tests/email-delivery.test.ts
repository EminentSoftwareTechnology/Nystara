import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import type { RenderedEmail } from "../lib/email/send";

function loadModule<T>(path: string, env: Record<string, string>, imports: Record<string, unknown> = {}): T {
  const source = readFileSync(new URL(`../lib/email/${path}.ts`, import.meta.url), "utf8");
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
  const exports = {};
  runInNewContext(outputText, { exports, process: { env }, require: (id: string) => {
    assert.ok(id in imports, id);
    return imports[id];
  } });
  return exports as T;
}

type Provider = { usesResend: () => boolean };
type Delivery = { deliverEmail: (to: string, message: RenderedEmail, unsubscribeUrl?: string) => Promise<string> };
type Sent = RenderedEmail & { from: string; to: string; headers?: Record<string, string> };
const message = { subject: "Test", html: "<p>Test</p>", text: "Test" };

for (const [mode, provider, expected] of [
  ["development", "", true], ["development", "resend", true], ["development", "smtp", false],
  ["production", "", true], ["production", "smtp", true],
] as const) {
  test(`${mode} with ${provider || "default"} selects the expected delivery provider`, () => {
    assert.equal(loadModule<Provider>("provider", { NODE_ENV: mode, EMAIL_PROVIDER: provider }).usesResend(), expected);
  });
}

function delivery(env: Record<string, string>, failure = false, synthetic = false) {
  const sends: Sent[] = [];
  let smtpClosed = false;
  const send = loadModule<Delivery>("send", env, {
    "../prisma": { prisma: { user: { findUnique: async () => ({ isSynthetic: synthetic }) } } },
    "./provider": loadModule<Provider>("provider", env),
    "./templates": {},
    resend: { Resend: class {
      emails = { send: async (input: Sent) => {
        sends.push(input);
        return failure ? { error: { name: "validation_error", message: "private provider details" } } : { data: { id: "resend-id" } };
      } };
    } },
    nodemailer: { createTransport: () => ({
      sendMail: async (input: Sent) => { sends.push(input); return { messageId: "smtp-id" }; },
      close: () => { smtpClosed = true; },
    }) },
  });
  return { ...send, sends, smtpClosed: () => smtpClosed };
}

test("default Resend delivery preserves content, unsubscribe headers and provider ID", async () => {
  const client = delivery({ NODE_ENV: "development", RESEND_API_KEY: "test-only" });
  const unsubscribe = "https://example.test/unsubscribe?token=test-only";
  assert.equal(await client.deliverEmail("reader@example.test", message, unsubscribe), "resend-id");
  assert.equal(client.sends[0].from, "Nystara <noreply@nystara.com>");
  assert.equal(client.sends[0].html, message.html);
  assert.equal(client.sends[0].text, message.text);
  assert.equal(client.sends[0].headers?.["List-Unsubscribe"], `<${unsubscribe}>`);
  assert.equal(client.sends[0].headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

test("synthetic recipients never reach SMTP or Resend", async () => {
  for (const EMAIL_PROVIDER of ["smtp", "resend"]) {
    const client = delivery({ EMAIL_PROVIDER }, false, true);
    await assert.rejects(client.deliverEmail("amina.nystara@gmail.com", message), /Synthetic accounts/);
    assert.equal(client.sends.length, 0);
  }
});

test("configured sender is used and essential mail has no unsubscribe headers", async () => {
  const client = delivery({ EMAIL_FROM: "Nystara <mail@example.test>" });
  await client.deliverEmail("reader@example.test", message);
  assert.equal(client.sends[0].from, "Nystara <mail@example.test>");
  assert.equal(client.sends[0].headers, undefined);
});

test("Resend rejection fails delivery without exposing provider details", async () => {
  await assert.rejects(delivery({}, true).deliverEmail("reader@example.test", message), { message: "Email delivery failed: validation_error" });
});

test("explicit development SMTP capture stays available and closes the transport", async () => {
  const client = delivery({ NODE_ENV: "development", EMAIL_PROVIDER: "smtp" });
  assert.equal(await client.deliverEmail("reader@example.test", message), "smtp-id");
  assert.equal(client.sends[0].from, "Nystara <noreply@nystara.local>");
  assert.equal(client.smtpClosed(), true);
});
