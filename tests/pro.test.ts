import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { ModuleKind, transpileModule } from "typescript";
import { NextRequest } from "next/server";
import { isProTheme } from "../lib/plans";
import { speechChunks } from "../components/article/ListenButton";

const require = createRequire(import.meta.url);
type Exports = Record<string, (...args: never[]) => unknown>;

/** Loads a TypeScript module with its "@/..." imports replaced by fakes. */
function load(path: string, imports: Record<string, unknown>, env: Record<string, string> = {}): Exports {
  const exports: Exports = {};
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
  runInNewContext(outputText, {
    exports, Request, Response, URL, Date, Math, Promise, Set, process: { env },
    require: (id: string) => (id in imports ? imports[id] : require(id)),
  });
  return exports;
}

const future = new Date(Date.now() + 86400_000);
const premium = require("../lib/premium") as unknown;
const reactCache = { cache: <T>(fn: T) => fn };

function plans(launched: boolean, sub: { status: string; currentPeriodEnd: Date } | null) {
  const db = { siteSetting: { findUnique: async () => ({ proEnabled: launched }) }, subscription: { findUnique: async () => sub } };
  return load("lib/pro.ts", { react: reactCache, "@/lib/prisma": { prisma: db }, "@/lib/premium": premium, "@/lib/plans": require("../lib/plans") }) as {
    planFor: (launched: boolean, sub: { status: string; currentPeriodEnd: Date } | null) => { launched: boolean; subscribed: boolean; pro: boolean };
    getPlan: (userId: string) => Promise<{ pro: boolean; launched: boolean; subscribed: boolean }>;
  } & Exports;
}

test("before launch every member is Pro; after launch only paying subscribers are", async () => {
  const { planFor } = plans(false, null);
  assert.deepEqual({ ...planFor(false, null) }, { launched: false, subscribed: false, pro: true });
  assert.deepEqual({ ...planFor(true, null) }, { launched: true, subscribed: false, pro: false });
  assert.equal(planFor(true, { status: "ACTIVE", currentPeriodEnd: future }).pro, true);
  assert.equal(planFor(true, { status: "TRIALING", currentPeriodEnd: future }).pro, true);
  assert.equal(planFor(true, { status: "PAST_DUE", currentPeriodEnd: future }).pro, false);
  assert.equal(planFor(true, { status: "ACTIVE", currentPeriodEnd: new Date(Date.now() - 1000) }).pro, false);
  assert.equal((await plans(true, null).getPlan("u")).pro, false);
  assert.equal((await plans(false, null).getPlan("u")).pro, true);
});

test("only the three Pro themes are locked", () => {
  assert.deepEqual(["classic", "modern", "editorial", "elegant", "bold", "technical"].filter(isProTheme), ["editorial", "elegant", "bold"]);
});

test("listening splits text into short sentence chunks without losing words", () => {
  const text = "One. Two is here! " + "word ".repeat(120) + "end?";
  const chunks = speechChunks(text, 100);
  assert.ok(chunks.every((chunk) => chunk.length <= 100));
  assert.equal(chunks.join(" ").replace(/\s+/g, " "), text.replace(/\s+/g, " ").trim());
  assert.deepEqual(speechChunks("   "), []);
});

// --- Stripe sync ---

type Row = { userId: string; stripeSubscriptionId: string; status: string; currentPeriodEnd: Date; cancelAtPeriodEnd: boolean; stripePriceId: string };
function fakeDb() {
  const events = new Set<string>();
  const subs = new Map<string, Row>();
  const tx = {
    stripeEvent: {
      findUnique: async ({ where }: { where: { id: string } }) => (events.has(where.id) ? { id: where.id } : null),
      create: async ({ data }: { data: { id: string } }) => { events.add(data.id); },
    },
    user: { findUnique: async ({ where }: { where: { stripeCustomerId: string } }) => (where.stripeCustomerId === "cus_1" ? { id: "user-1" } : null) },
    subscription: {
      findUnique: async ({ where }: { where: { userId: string } }) => subs.get(where.userId) ?? null,
      upsert: async ({ where, create }: { where: { userId: string }; create: Row }) => { subs.set(where.userId, create); },
    },
  };
  return { events, subs, prisma: { $transaction: <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx) } };
}
function billing(db: ReturnType<typeof fakeDb>) {
  return load("lib/billing.ts", { "@/lib/prisma": { prisma: db.prisma } }) as unknown as {
    toSubStatus: (s: string) => string;
    eventSubscriptionId: (e: object) => string | null;
    recordStripeEvent: (e: object, s: object | null) => Promise<boolean>;
  };
}
function stripeSub(id: string, status: string, customer = "cus_1") {
  return { id, status, customer, cancel_at_period_end: false, ended_at: null, items: { data: [{ price: { id: "price_pro" }, current_period_end: Math.floor(future.getTime() / 1000) }] } };
}

test("Stripe statuses map onto the stored enum", () => {
  const { toSubStatus } = billing(fakeDb());
  assert.equal(toSubStatus("active"), "ACTIVE");
  assert.equal(toSubStatus("trialing"), "TRIALING");
  for (const s of ["past_due", "unpaid", "incomplete"]) assert.equal(toSubStatus(s), "PAST_DUE");
  for (const s of ["canceled", "incomplete_expired", "paused"]) assert.equal(toSubStatus(s), "CANCELED");
});

test("events resolve to a subscription id only for subscription checkouts and subscription events", () => {
  const { eventSubscriptionId } = billing(fakeDb());
  assert.equal(eventSubscriptionId({ type: "checkout.session.completed", data: { object: { mode: "subscription", subscription: "sub_1" } } }), "sub_1");
  assert.equal(eventSubscriptionId({ type: "checkout.session.completed", data: { object: { mode: "payment", subscription: null } } }), null);
  assert.equal(eventSubscriptionId({ type: "customer.subscription.updated", data: { object: { id: "sub_2" } } }), "sub_2");
});

test("webhook sync upserts by customer, ignores replays and never lets an old canceled subscription replace a live one", async () => {
  const db = fakeDb();
  const { recordStripeEvent } = billing(db);
  assert.equal(await recordStripeEvent({ id: "evt_1", type: "customer.subscription.created" }, stripeSub("sub_new", "active")), true);
  assert.equal(db.subs.get("user-1")?.status, "ACTIVE");
  assert.equal(db.subs.get("user-1")?.stripePriceId, "price_pro");
  assert.equal(await recordStripeEvent({ id: "evt_1", type: "customer.subscription.created" }, stripeSub("sub_new", "canceled")), false);
  assert.equal(db.subs.get("user-1")?.status, "ACTIVE");
  await recordStripeEvent({ id: "evt_2", type: "customer.subscription.deleted" }, stripeSub("sub_old", "canceled"));
  assert.equal(db.subs.get("user-1")?.stripeSubscriptionId, "sub_new");
  await recordStripeEvent({ id: "evt_3", type: "customer.subscription.deleted" }, stripeSub("sub_new", "canceled"));
  assert.equal(db.subs.get("user-1")?.status, "CANCELED");
  await recordStripeEvent({ id: "evt_4", type: "customer.subscription.created" }, stripeSub("sub_x", "active", "cus_unknown"));
  assert.equal(db.subs.size, 1);
  assert.ok(db.events.has("evt_4"));
});

test("webhook rejects missing or forged signatures before touching the database", async () => {
  let recorded = 0;
  const stripe = { webhooks: { constructEventAsync: async () => { throw new Error("bad signature"); } } };
  const route = load("app/api/stripe/webhook/route.ts", {
    "next/server": require("next/server"),
    "@/lib/request": { readBody: async (r: Request) => r.text() },
    "@/lib/billing": { HANDLED_EVENTS: new Set(), eventSubscriptionId: () => null, recordStripeEvent: async () => { recorded++; return true; } },
    "@/lib/stripe": { stripe },
  }, { STRIPE_WEBHOOK_SECRET: "whsec_test", STRIPE_SECRET_KEY: "sk_test" }) as unknown as { POST: (r: Request) => Promise<Response> };
  const url = "https://nystara.test/api/stripe/webhook";
  assert.equal((await route.POST(new Request(url, { method: "POST", body: "{}" }))).status, 400);
  assert.equal((await route.POST(new Request(url, { method: "POST", body: "{}", headers: { "stripe-signature": "t=1,v1=forged" } }))).status, 400);
  assert.equal(recorded, 0);
});

test("checkout refuses signed-out users, an unlaunched plan and members who already subscribe", async () => {
  const user = { email: "a@example.test", stripeCustomerId: "cus_1", subscription: { status: "PAST_DUE" } };
  const make = (identity: string | null, launched: boolean) => load("app/api/billing/checkout/route.ts", {
    "next/server": require("next/server"),
    "@/lib/auth": { auth: async () => (identity ? { user: { id: identity } } : null) },
    "@/lib/prisma": { prisma: { user: { findUnique: async () => user } } },
    "@/lib/rate-limit": { rateLimit: async () => ({ ok: true }) },
    "@/lib/pro": { isProLaunched: async () => launched },
    "@/lib/stripe": { stripe: {} },
  }, { STRIPE_PRO_PRICE_ID: "price_pro", STRIPE_SECRET_KEY: "sk_test" }) as unknown as { POST: () => Promise<Response> };
  assert.equal((await make(null, true).POST()).status, 401);
  assert.equal((await make("user-1", false).POST()).status, 409);
  assert.equal((await make("user-1", true).POST()).status, 409);
});

test("admins cannot launch Pro until Stripe is fully configured", async () => {
  const route = load("app/api/admin/billing/route.ts", {
    "next/server": require("next/server"),
    zod: require("zod"),
    "@/lib/admin-auth": { getVerifiedAdminSession: async () => ({ sub: "admin" }) },
    "@/lib/audit": { audit: () => undefined },
    "@/lib/prisma": { prisma: { siteSetting: { upsert: async () => { throw new Error("must not save"); } } } },
    "@/lib/request": { readJson: (r: Request) => r.json() },
    "@/lib/pro": { stripeConfig: () => ({ secretKey: true, priceId: false, webhookSecret: true }), stripeReady: () => false },
  }) as unknown as { PUT: (r: Request) => Promise<Response> };
  const response = await route.PUT(new Request("https://nystara.test/api/admin/billing", { method: "PUT", body: JSON.stringify({ proEnabled: true }) }));
  assert.equal(response.status, 409);
});

test("proxy lets signed Stripe webhooks through without an Origin but still blocks other cross-site writes", async () => {
  process.env.NEXTAUTH_URL = "https://example.test";
  const { default: proxy } = await import("../proxy");
  const webhook = await proxy(new NextRequest("https://example.test/api/stripe/webhook", { method: "POST", body: "{}" }));
  assert.notEqual(webhook.status, 403);
  const other = await proxy(new NextRequest("https://example.test/api/billing/checkout", { method: "POST", body: "{}" }));
  assert.equal(other.status, 403);
  const put = await proxy(new NextRequest("https://example.test/api/stripe/webhook", { method: "PUT", body: "{}" }));
  assert.equal(put.status, 403);
});
