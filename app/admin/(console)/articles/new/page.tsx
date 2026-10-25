"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewArticlePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    contentText: "",
    memberOnly: false,
    published: false,
    tagSlugs: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const tagSlugs = form.tagSlugs
      .split(",")
      .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
      .filter(Boolean);

    const res = await fetch("/api/admin/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, tagSlugs }),
    });

    if (res.ok) {
      router.push("/admin/articles");
    } else {
      const data = await res.json() as { error?: string };
      setError(typeof data.error === "string" ? data.error : "Failed to create article.");
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/admin/articles" className="text-sm text-muted hover:text-foreground">
          ← Articles
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-6">New article</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-background rounded-2xl border border-border p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Title *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-border-strong bg-background text-sm focus:outline-none focus:ring-2 focus:ring-border-strong"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Subtitle</label>
            <input
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-border-strong bg-background text-sm focus:outline-none focus:ring-2 focus:ring-border-strong"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Content *</label>
            <textarea
              required
              rows={14}
              value={form.contentText}
              onChange={(e) => setForm({ ...form, contentText: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border border-border-strong bg-background text-sm focus:outline-none focus:ring-2 focus:ring-border-strong resize-y font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tags <span className="font-normal text-muted">(comma-separated, max 5)</span>
            </label>
            <input
              value={form.tagSlugs}
              onChange={(e) => setForm({ ...form, tagSlugs: e.target.value })}
              placeholder="react, typescript, nextjs"
              className="w-full px-3 py-2.5 rounded-lg border border-border-strong bg-background text-sm focus:outline-none focus:ring-2 focus:ring-border-strong"
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.memberOnly}
                onChange={(e) => setForm({ ...form, memberOnly: e.target.checked })}
                className="rounded"
              />
              Members only
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="rounded"
              />
              Publish immediately
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create article"}
          </button>
          <Link href="/admin/articles" className="px-6 py-2.5 rounded-lg border border-border-strong text-sm font-medium hover:bg-surface">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
