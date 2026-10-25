"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type User = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  role: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  _count: { articles: number; followers: number; following: number };
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((r) => r.json())
      .then((data: User) => {
        setUser(data);
        setRole(data.role as "USER" | "ADMIN");
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setSaving(false);
    setMsg(res.ok ? "Saved." : "Failed.");
    setTimeout(() => setMsg(""), 2000);
  }

  async function handleDelete() {
    if (!confirm("Delete this user and all their data? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/users");
    } else {
      const data = await res.json() as { error?: string };
      alert(data.error ?? "Delete failed.");
      setDeleting(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!user) return <div className="p-8 text-gray-500">User not found.</div>;

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/admin/users" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          ← Users
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {user.name ?? user.email}
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400 mb-1">Email</p>
            <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 mb-1">Username</p>
            <p className="font-medium text-gray-900 dark:text-white">{user.username ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 mb-1">Joined</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 mb-1">Stats</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {user._count.articles} articles · {user._count.followers} followers
            </p>
          </div>
          {user.bio && (
            <div className="col-span-2">
              <p className="text-gray-500 dark:text-gray-400 mb-1">Bio</p>
              <p className="text-gray-900 dark:text-white">{user.bio}</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
          <div className="flex gap-3">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none"
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save role"}
            </button>
            {msg && <span className="text-sm text-green-600 dark:text-green-400 self-center">{msg}</span>}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-3">Danger zone</h3>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete user"}
          </button>
        </div>
      </div>
    </div>
  );
}
