import { PrismaAdapter } from "@auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";
import type { prisma as appPrisma } from "./prisma";

/**
 * The Prisma adapter, except that:
 * - deleting a session that is already gone succeeds. Auth.js deletes the browser's current session when signing
 *   in or out; with a stale cookie the stock `delete` throws and the sign-in fails.
 * - verification tokens are found by their (hashed, unique) token, because the identifier column is encrypted.
 */
export function authAdapter(client: typeof appPrisma) {
  return {
    ...PrismaAdapter(client as unknown as PrismaClient),
    async deleteSession(sessionToken: string) {
      await client.session.deleteMany({ where: { sessionToken } });
    },
    async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
      const row = await client.verificationToken.findUnique({ where: { token } });
      if (!row || row.identifier.toLowerCase() !== identifier.toLowerCase()) return null;
      const { count } = await client.verificationToken.deleteMany({ where: { token } });
      return count ? { identifier: row.identifier, token: row.token, expires: row.expires } : null;
    },
  };
}
