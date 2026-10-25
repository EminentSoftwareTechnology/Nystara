import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/request";

export const dynamic = "force-dynamic";

type SearchParams = { page?: string; q?: string };

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { page: pageStr, q } = await searchParams;
  const page = parsePage(pageStr);
  const take = 20;
  const skip = (page - 1) * take;

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{total.toLocaleString()} total</p>
        </div>
      </div>

      {/* Search */}
      <form className="mb-6">
        <div className="flex gap-2 max-w-sm">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name, email, username…"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
          />
          <button type="submit" className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium">
            Search
          </button>
        </div>
      </form>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">User</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Role</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Articles</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-white">{user.name ?? user.email}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                  {user.username && <p className="text-xs text-gray-400">@{user.username}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    user.role === "ADMIN"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{user._count.articles}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
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
          <span className="text-gray-500 dark:text-gray-400">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={`?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
