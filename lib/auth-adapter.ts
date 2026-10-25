import { PrismaAdapter } from "@auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";

/**
 * The Prisma adapter, except that deleting a session that is already gone succeeds. Auth.js deletes the browser's
 * current session when signing in or out; with a stale cookie the stock `delete` throws and the sign-in fails.
 */
export function authAdapter(client: PrismaClient) {
  return {
    ...PrismaAdapter(client),
    async deleteSession(sessionToken: string) {
      await client.session.deleteMany({ where: { sessionToken } });
    },
  };
}
