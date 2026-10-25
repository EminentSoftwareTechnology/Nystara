import { getVerifiedAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/request";

export const dynamic = "force-dynamic";

type SearchParams = { page?: string; q?: string };

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!(await getVerifiedAdminSession())) redirect("/admin/login");
  const { page: pageStr, q: query } = await searchParams;
  const page = parsePage(pageStr);
  const q = query?.slice(0, 200);
  const take = 20;
  const skip = (page - 1) * take;

  const where = q
    ? {
        OR: [
          // Email is encrypted at rest: a full address matches exactly.
          { email: q },
          { name: { contains: q, mode: "insensitive" as const } },
          { username: { contains: q, mode: "insensitive" as const } },
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
        createdAt: true,
        _count: { select: { articles: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const pages = Math.ceil(total / take);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Users</h1>
          <p className="text-sm text-muted mt-0.5">{total.toLocaleString()} total</p>
        </div>
      </div>

      {/* Search */}
      <form className="mb-6">
        <div className="flex gap-2 max-w-sm">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name, username or full email…"
            className="flex-1 px-3 py-2 rounded-lg border border-border-strong bg-background text-sm focus:outline-none focus:ring-2 focus:ring-border-strong"
          />
          <button type="submit" className="px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium">
            Search
          </button>
        </div>
      </form>

      <div className="bg-background rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-page border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted">User</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Articles</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-surface">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{user.name ?? user.email}</p>
                  <p className="text-xs text-muted">{user.email}</p>
                  {user.username && <p className="text-xs text-muted">@{user.username}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    user.role === "ADMIN"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                      : "bg-surface text-muted"
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{user._count.articles}</td>
                <td className="px-4 py-3 text-muted">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-xs text-muted hover:text-foreground underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="px-3 py-1.5 rounded border border-border-strong hover:bg-surface">
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={`?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="px-3 py-1.5 rounded border border-border-strong hover:bg-surface">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
