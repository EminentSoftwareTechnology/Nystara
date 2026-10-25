import { loadEnvConfig } from "@next/env";

// One-off, idempotent: encrypts personal-data columns written before field encryption and fills blind indexes.
// Run after `prisma migrate deploy`: npm run db:encrypt
async function main() {
  loadEnvConfig(process.cwd());
  const { prisma } = await import("../lib/prisma");
  const { ENCRYPTED_FIELDS } = await import("../lib/prisma-encryption");
  const { blindIndex, isEncrypted } = await import("../lib/field-encryption");
  const { Prisma } = await import("@prisma/client");
  const keyOf: Record<string, string> = { VerificationToken: "token" };
  try {
    for (const [model, { fields, indexed }] of Object.entries(ENCRYPTED_FIELDS)) {
      const key = keyOf[model] ?? "id";
      const table = `"${model}"`;
      // Keep @updatedAt timestamps so a backfill doesn't reorder recent conversations.
      const keepsUpdatedAt = Prisma.dmmf.datamodel.models.find((entry) => entry.name === model)?.fields.some((field) => field.name === "updatedAt");
      const columns = [key, ...fields, ...Object.values(indexed ?? {}), ...(keepsUpdatedAt ? ["updatedAt"] : [])].map((column) => `"${column}"`).join(", ");
      const rows = await prisma.$queryRawUnsafe<Record<string, string | null | Date>[]>(`SELECT ${columns} FROM ${table}`);
      let updated = 0;
      for (const row of rows) {
        const text = (field: string) => (typeof row[field] === "string" ? (row[field] as string) : null);
        const plaintext = fields.filter((field) => text(field) !== null && !isEncrypted(text(field)!));
        const missingIndex = Object.entries(indexed ?? {}).filter(([, hash]) => !row[hash]).map(([field]) => field);
        if (!plaintext.length && !missingIndex.length) continue;
        // Writing through the extended client encrypts the values and sets their blind indexes.
        const data: Record<string, string | Date | null> = Object.fromEntries(plaintext.map((field) => [field, text(field)]));
        for (const field of missingIndex) if (text(field) !== null && !isEncrypted(text(field)!)) data[field] = text(field);
        if (keepsUpdatedAt) data.updatedAt = row.updatedAt;
        const delegate = (prisma as unknown as Record<string, { update: (args: object) => Promise<unknown> }>)[model[0].toLowerCase() + model.slice(1)];
        try {
          await delegate.update({ where: { [key]: row[key] }, data });
          updated++;
        } catch (error) {
          const email = missingIndex[0] ? text(missingIndex[0]) : null;
          const hash = email ? blindIndex(email).slice(0, 8) : "";
          console.error(`${model} ${row[key]}: update failed${hash ? ` (another row already uses this email, hash ${hash})` : ""}`, error instanceof Error ? error.message : "");
          process.exitCode = 1;
        }
      }
      console.info(`${model}: ${updated} of ${rows.length} rows encrypted`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Encryption backfill failed", error instanceof Error ? error.message : "");
  process.exitCode = 1;
});
