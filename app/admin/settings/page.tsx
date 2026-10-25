"use client";

import { useState } from "react";

type Theme = "light" | "dark" | "system";

const themes: { value: Theme; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Always use the light theme" },
  { value: "dark", label: "Dark", description: "Always use the dark theme" },
  { value: "system", label: "System", description: "Follow your OS preference" },
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "system";
    const stored = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("theme="))
      ?.split("=")[1];
    return (stored as Theme | undefined) ?? "system";
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
      const root = document.documentElement;
      if (theme === "dark") {
        root.classList.add("dark");
      } else if (theme === "light") {
        root.classList.remove("dark");
      } else {
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      }
      setMsg("Theme saved.");
    } else {
      setMsg("Failed to save.");
    }
    setTimeout(() => setMsg(""), 3000);
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Appearance</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Choose how TechScribe looks for you.</p>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {themes.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTheme(t.value)}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                theme === t.value
                  ? "border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-700"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className={`w-full h-10 rounded mb-3 ${
                t.value === "light"
                  ? "bg-white border border-gray-200"
                  : t.value === "dark"
                  ? "bg-gray-900"
                  : "bg-gradient-to-r from-white to-gray-900"
              }`} />
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.description}</p>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save preference"}
          </button>
          {msg && <span className="text-sm text-green-600 dark:text-green-400">{msg}</span>}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mt-4">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Default admin credentials</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          The seeded admin account uses these defaults. Change your password in Profile settings.
        </p>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 font-mono text-sm space-y-1">
          <p><span className="text-gray-500">Email: </span><span className="text-gray-900 dark:text-white">admin@techscribe.io</span></p>
          <p><span className="text-gray-500">Password: </span><span className="text-gray-900 dark:text-white">TechScribe@Admin123</span></p>
        </div>
      </div>
    </div>
  );
}
