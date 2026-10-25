import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { authAdapter } from "../lib/auth-adapter";

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
  } as unknown as PrismaClient;
  await authAdapter(client).deleteSession("stale-token");
  assert.deepEqual(deleted, [{ where: { sessionToken: "stale-token" } }]);
});
