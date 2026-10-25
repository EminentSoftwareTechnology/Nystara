"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Profile = {
  id: string;
  email: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

export default function AdminProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", bio: "" });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [msg, setMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((data: Profile) => {
        setProfile(data);
        setForm({ name: data.name ?? "", bio: data.bio ?? "" });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, bio: form.bio }),
    });
    setSaving(false);
    setMsg(res.ok ? "Profile updated." : "Failed to update.");
    setTimeout(() => setMsg(""), 3000);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwMsg("Passwords do not match.");
      return;
    }
    setChangingPw(true);
    const res = await fetch("/api/admin/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
    });
    const data = await res.json() as { error?: string };
    setChangingPw(false);
    setPwMsg(res.ok ? "Password changed." : (data.error ?? "Failed."));
    if (res.ok) {
      setPwForm({ currentPassword: "", newPassword: "", confirm: "" });
      router.replace("/admin/login");
      router.refresh();
    }
    setTimeout(() => setPwMsg(""), 4000);
  }

  if (loading) return <div className="p-8 text-muted">Loading…</div>;
  if (!profile) return null;

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-8">My profile</h1>

      {/* Profile info */}
      <form onSubmit={handleProfileSave} className="bg-background rounded-2xl border border-border p-6 space-y-4 mb-6">
        <h2 className="font-semibold text-foreground">Account details</h2>
        <div>
          <label className="block text-sm text-muted mb-1">Email</label>
          <p className="text-sm font-medium text-foreground">{profile.email}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Display name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-border-strong bg-background text-sm focus:outline-none focus:ring-2 focus:ring-border-strong"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Bio</label>
          <textarea
            rows={3}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-border-strong bg-background text-sm focus:outline-none focus:ring-2 focus:ring-border-strong resize-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
          {msg && <span className="text-sm text-green-600 dark:text-green-400">{msg}</span>}
        </div>
      </form>

      {/* Change password */}
      <form onSubmit={handlePasswordChange} className="bg-background rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Change password</h2>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Current password</label>
          <input
            type="password"
            required
            value={pwForm.currentPassword}
            onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-border-strong bg-background text-sm focus:outline-none focus:ring-2 focus:ring-border-strong"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">New password (min 8 chars)</label>
          <input
            type="password"
            required
            minLength={8}
            value={pwForm.newPassword}
            onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-border-strong bg-background text-sm focus:outline-none focus:ring-2 focus:ring-border-strong"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Confirm new password</label>
          <input
            type="password"
            required
            value={pwForm.confirm}
            onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-border-strong bg-background text-sm focus:outline-none focus:ring-2 focus:ring-border-strong"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={changingPw}
            className="px-5 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {changingPw ? "Changing…" : "Change password"}
          </button>
          {pwMsg && (
            <span className={`text-sm ${pwMsg.includes("changed") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {pwMsg}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
