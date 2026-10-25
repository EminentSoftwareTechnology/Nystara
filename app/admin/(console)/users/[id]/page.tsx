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

  if (loading) return <div className="p-8 text-muted">Loading…</div>;
  if (!user) return <div className="p-8 text-muted">User not found.</div>;

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/admin/users" className="text-sm text-muted hover:text-foreground">
          ← Users
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-6">
        {user.name ?? user.email}
      </h1>

      <div className="bg-background rounded-2xl border border-border p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted mb-1">Email</p>
            <p className="font-medium text-foreground">{user.email}</p>
          </div>
          <div>
            <p className="text-muted mb-1">Username</p>
            <p className="font-medium text-foreground">{user.username ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted mb-1">Joined</p>
            <p className="font-medium text-foreground">
              {new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div>
            <p className="text-muted mb-1">Stats</p>
            <p className="font-medium text-foreground">
              {user._count.articles} articles · {user._count.followers} followers
            </p>
          </div>
          {user.bio && (
            <div className="col-span-2">
              <p className="text-muted mb-1">Bio</p>
              <p className="text-foreground">{user.bio}</p>
            </div>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <label className="block text-sm font-medium text-foreground mb-2">Role</label>
          <div className="flex gap-3">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
              className="px-3 py-2 rounded-lg border border-border-strong bg-background text-sm focus:outline-none"
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save role"}
            </button>
            {msg && <span className="text-sm text-green-600 dark:text-green-400 self-center">{msg}</span>}
          </div>
        </div>

        <div className="border-t border-border pt-4">
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
