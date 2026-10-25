import { getVerifiedAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/request";

export const dynamic = "force-dynamic";

type SearchParams = { page?: string; q?: string; status?: string };

export default async function AdminArticlesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!(await getVerifiedAdminSession())) redirect("/admin/login");
  const { page: pageStr, q: query, status } = await searchParams;
  const page = parsePage(pageStr);
  const q = query?.slice(0, 200);
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Articles</h1>
          <p className="text-sm text-muted mt-0.5">{total.toLocaleString()} total</p>
        </div>
        <Link
          href="/admin/articles/new"
          className="px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-colors"
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
          className="px-3 py-2 rounded-lg border border-border-strong bg-background text-sm focus:outline-none flex-1 min-w-48"
        />
        <select name="status" defaultValue={status ?? ""} className="px-3 py-2 rounded-lg border border-border-strong bg-background text-sm focus:outline-none">
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <button type="submit" className="px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium">
          Filter
        </button>
      </form>

      <div className="bg-background rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-page border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted">Title</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Author</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {articles.map((a) => (
              <tr key={a.id} className="hover:bg-surface">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground line-clamp-1">{a.title}</p>
                  <p className="text-xs text-muted">{a.readTime} min · {a._count.claps} claps · {a._count.comments} comments</p>
                </td>
                <td className="px-4 py-3 text-muted">{a.author.name ?? a.author.username}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.published
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-surface text-muted"
                  }`}>
                    {a.published ? "Live" : "Draft"}
                  </span>
                  {a.memberOnly && (
                    <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium">
                      Member
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">
                  {new Date(a.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Link href={`/admin/articles/${a.id}`} className="text-xs text-muted hover:text-foreground underline">
                    View
                  </Link>
                  <Link href={`/admin/articles/${a.id}/edit`} className="text-xs text-muted hover:text-foreground underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {articles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No articles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`} className="px-3 py-1.5 rounded border border-border-strong hover:bg-surface">
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={`?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`} className="px-3 py-1.5 rounded border border-border-strong hover:bg-surface">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
