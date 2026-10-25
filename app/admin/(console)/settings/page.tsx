"use client";

import { useState } from "react";
import Link from "next/link";
import { type Theme, isExplicitTheme } from "@/lib/theme";

const themes: { value: Theme; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Always use the light theme" },
  { value: "dark", label: "Dark", description: "Always use the dark theme" },
  { value: "sand", label: "Sand", description: "A warm, paper-like light theme" },
  { value: "system", label: "System", description: "Follow your OS preference" },
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "system";
    const stored = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("theme="))
      ?.split("=")[1];
    return isExplicitTheme(stored) ? stored : "system";
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/admin/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    });
    setSaving(false);

    if (res.ok) {
      // Apply theme immediately
      if (theme === "system") document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", theme);
      setMsg("Theme saved.");
    } else {
      setMsg("Failed to save.");
    }
    setTimeout(() => setMsg(""), 3000);
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-8">Settings</h1>

      <div className="bg-background rounded-2xl border border-border p-6">
        <h2 className="font-semibold text-foreground mb-1">Appearance</h2>
        <p className="text-sm text-muted mb-5">Choose how Nystara looks for you.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {themes.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTheme(t.value)}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                theme === t.value
                  ? "border-foreground bg-page"
                  : "border-border hover:border-border-strong"
              }`}
            >
              <div className={`w-full h-10 rounded mb-3 ${
                t.value === "light"
                  ? "bg-white border border-gray-200"
                  : t.value === "dark"
                  ? "bg-black border border-gray-800"
                  : t.value === "sand"
                  ? "bg-[#f1f0eb] border border-[#d3d1c8]"
                  : "bg-gradient-to-r from-white to-gray-900"
              }`} />
              <p className="text-sm font-medium text-foreground">{t.label}</p>
              <p className="text-xs text-muted mt-0.5">{t.description}</p>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save preference"}
          </button>
          {msg && <span className="text-sm text-green-600 dark:text-green-400">{msg}</span>}
        </div>
      </div>

      <div className="bg-background rounded-2xl border border-border p-6 mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-foreground mb-1">Sign-in security</h2>
          <p className="text-sm text-muted">Add a passkey or an authenticator app to protect the admin console.</p>
        </div>
        <Link href="/admin/security" className="px-5 py-2 rounded-full border border-border-strong text-sm font-medium hover:bg-surface-2">
          Manage security
        </Link>
      </div>
    </div>
  );
}
