import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fieldEncryption } from "./prisma-encryption";

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  return new PrismaClient({ adapter, errorFormat: "minimal" }).$extends(fieldEncryption);
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
