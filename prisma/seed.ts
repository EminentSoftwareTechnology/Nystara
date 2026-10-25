import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@techscribe.io";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD env var is required");
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", passwordHash },
    create: {
      email,
      name: "Admin",
      username: "admin",
      role: "ADMIN",
      passwordHash,
    },
  });

  console.log(`Admin seeded: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
