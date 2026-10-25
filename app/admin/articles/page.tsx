import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/request";

export const dynamic = "force-dynamic";

type SearchParams = { page?: string; q?: string; status?: string };

export default async function AdminArticlesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { page: pageStr, q, status } = await searchParams;
  const page = parsePage(pageStr);
  const take = 20;
  const skip = (page - 1) * take;

  const where = {
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    ...(status === "published" ? { published: true } : status === "draft" ? { published: false } : {}),
  };

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        published: true,
        memberOnly: true,
        readTime: true,
        createdAt: true,
        author: { select: { username: true, name: true } },
        _count: { select: { claps: true, comments: true } },
      },
    }),
    prisma.article.count({ where }),
  ]);

  const pages = Math.ceil(total / take);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Articles</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{total.toLocaleString()} total</p>
        </div>
        <Link
          href="/admin/articles/new"
          className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
        >
          + New article
        </Link>
      </div>

      {/* Filters */}
      <form className="flex gap-2 mb-6 flex-wrap">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by title…"
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none flex-1 min-w-48"
        />
        <select name="status" defaultValue={status ?? ""} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none">
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <button type="submit" className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium">
          Filter
        </button>
      </form>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Title</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Author</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {articles.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-white line-clamp-1">{a.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{a.readTime} min · {a._count.claps} claps · {a._count.comments} comments</p>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{a.author.name ?? a.author.username}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.published
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}>
                    {a.published ? "Live" : "Draft"}
                  </span>
                  {a.memberOnly && (
                    <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium">
                      Member
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {new Date(a.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Link href={`/admin/articles/${a.id}`} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline">
                    View
                  </Link>
                  <Link href={`/admin/articles/${a.id}/edit`} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {articles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No articles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`} className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={`?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`} className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
