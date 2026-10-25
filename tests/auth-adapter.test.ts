import assert from "node:assert/strict";
import { test } from "node:test";
import { authAdapter } from "../lib/auth-adapter";

type Client = Parameters<typeof authAdapter>[0];

test("deleting a session whose row is already gone does not fail sign-in", async () => {
  const deleted: unknown[] = [];
  const client = {
    session: {
      delete: () => Promise.reject(new Error("No record was found for a delete.")),
      deleteMany: (args: unknown) => {
        deleted.push(args);
        return Promise.resolve({ count: 0 });
      },
    },
  } as unknown as Client;
  await authAdapter(client).deleteSession("stale-token");
  assert.deepEqual(deleted, [{ where: { sessionToken: "stale-token" } }]);
});

test("verification tokens are consumed once and only for their own email", async () => {
  const expires = new Date(Date.now() + 60_000);
  let stored = true;
  const client = {
    verificationToken: {
      findUnique: () => Promise.resolve(stored ? { identifier: "Reader@Example.com", token: "t1", expires } : null),
      deleteMany: () => {
        const count = stored ? 1 : 0;
        stored = false;
        return Promise.resolve({ count });
      },
    },
  } as unknown as Client;
  const adapter = authAdapter(client);
  assert.equal(await adapter.useVerificationToken({ identifier: "someone@else.com", token: "t1" }), null);
  assert.deepEqual(await adapter.useVerificationToken({ identifier: "reader@example.com", token: "t1" }), { identifier: "Reader@Example.com", token: "t1", expires });
  assert.equal(await adapter.useVerificationToken({ identifier: "reader@example.com", token: "t1" }), null);
});
