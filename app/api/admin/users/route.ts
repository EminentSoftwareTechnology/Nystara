import { NextRequest, NextResponse } from "next/server";
import { getVerifiedAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/request";

export async function GET(req: NextRequest) {
  const session = await getVerifiedAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const page = parsePage(searchParams.get("page"));
  const take = 20;
  const skip = (page - 1) * take;
  const search = searchParams.get("q")?.slice(0, 200) || undefined;

  const where = search
    ? {
        OR: [
          // Email is encrypted at rest: a full address matches exactly.
          { email: search },
          { name: { contains: search, mode: "insensitive" as const } },
          { username: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        _count: { select: { articles: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, pages: Math.ceil(total / take) });
}
