"use client";

import { useState } from "react";
import { isExplicitTheme, type ExplicitTheme } from "@/lib/theme";

const swatches = { light: "bg-white text-black border-gray-200", dark: "bg-black text-white border-neutral-800", sand: "bg-[#f7f7f4] text-[#26251e] border-[#e6e5df]" };

export default function NotificationSettings({ preferences }: { preferences: { emailTheme: string; activityEmails: boolean } }) {
  const [theme, setTheme] = useState<ExplicitTheme>(isExplicitTheme(preferences.emailTheme) ? preferences.emailTheme : "light");
  const [activity, setActivity] = useState(preferences.activityEmails);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <form className="space-y-8 rounded-2xl border border-border bg-background p-6" onSubmit={async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/me/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailTheme: theme, activityEmails: activity }) });
      setMessage(response.ok ? "Email preferences saved." : "Could not save your preferences. Please retry.");
    } catch {
      setMessage("Could not connect. Please retry.");
    } finally { setBusy(false); }
  }}>
    <fieldset disabled={busy}>
      <legend className="text-lg font-semibold">Email appearance</legend>
      <p className="mt-2 text-sm text-muted">Emails use this saved theme, independently of your device appearance.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(["light", "dark", "sand"] as const).map((value) => <label key={value} className={`cursor-pointer rounded-xl border p-4 ${swatches[value]} ${theme === value ? "ring-2 ring-border-strong ring-offset-2 ring-offset-background" : ""}`}>
          <span className="flex items-center gap-2"><input type="radio" name="emailTheme" value={value} checked={theme === value} onChange={() => setTheme(value)} /><span className="capitalize">{value}</span></span>
          <span aria-hidden="true" className="mt-4 block font-display text-2xl">Nystara</span>
          <span aria-hidden="true" className="mt-1 block text-xs">A home for your words.</span>
        </label>)}
      </div>
    </fieldset>
    <div>
      <label className="flex items-start gap-3"><input type="checkbox" checked={activity} disabled={busy} onChange={(event) => setActivity(event.target.checked)} className="mt-1" /><span><span className="font-semibold">Activity emails</span><span className="mt-1 block text-sm text-muted">Welcome messages, story updates, comments, and replies.</span></span></label>
      <p className="mt-4 text-sm text-muted">Sign-in links and essential account and security alerts remain enabled.</p>
    </div>
    <button disabled={busy} className="min-h-12 rounded-full bg-accent px-6 font-medium text-accent-foreground disabled:opacity-50">{busy ? "Saving…" : "Save email preferences"}</button>
    <p role="status" className="text-sm">{message}</p>
  </form>;
}
