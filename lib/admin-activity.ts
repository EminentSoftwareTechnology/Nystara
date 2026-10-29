import { prisma } from "@/lib/prisma";

export async function monthlyActiveUsers(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const rows = await prisma.$queryRaw<{ month: string; users: number }[]>`
    SELECT to_char(a."day", 'YYYY-MM') AS month, COUNT(DISTINCT a."userId")::int AS users
    FROM "UserActivityDay" a JOIN "User" u ON u.id = a."userId"
    WHERE a."day" >= ${start} AND a."day" < ${end} AND u."isSynthetic" = false
    GROUP BY 1 ORDER BY 1
  `;
  return Array.from({ length: 12 }, (_, offset) => {
    const label = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1)).toISOString().slice(0, 7);
    return { label, value: rows.find((row) => row.month === label)?.users ?? 0 };
  });
}
