import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { passwordSchema } from "../lib/password";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@techscribe.io";
  const password = process.env.ADMIN_PASSWORD;
  if (!passwordSchema.safeParse(password).success) throw new Error("ADMIN_PASSWORD must be 12+ characters and at most 72 UTF-8 bytes");
  if (!password) throw new Error("ADMIN_PASSWORD is required");
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", passwordHash, sessionVersion: { increment: 1 } },
    create: {
      email,
      name: "Admin",
      username: "admin",
      role: "ADMIN",
      passwordHash,
    },
  });

  console.log(`Admin seeded: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
