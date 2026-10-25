"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImagePicker from "@/components/media/ImagePicker";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function ProfileSettings({
  user,
}: {
  user: { name: string | null; bio: string | null; username: string | null; avatarUrl: string | null };
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      className="grid gap-6 lg:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (uploading || busy) return;
        setBusy(true);
        setMessage("");
        try {
          const response = await fetch("/api/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, bio, ...(avatarUrl !== user.avatarUrl ? { avatarUrl } : {}) }),
          });
          setMessage(
            response.ok ? "Profile saved." : "Could not save your profile.",
          );
          if (response.ok) router.refresh();
        } catch {
          setMessage("Could not connect. Please retry.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <section className="space-y-5 rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold">About you</h2>
        <p className="text-sm text-muted">@{user.username}</p>
        <ImagePicker purpose="avatar" value={avatarUrl} onChange={setAvatarUrl} onUploading={setUploading} disabled={busy} />
        <label className="block text-sm">
          Display name
          <input
            value={name}
            required
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 block w-full rounded-lg border border-border bg-page p-3"
          />
        </label>
        <label className="block text-sm">
          Bio
          <textarea
            value={bio}
            maxLength={500}
            onChange={(event) => setBio(event.target.value)}
            rows={5}
            className="mt-2 block w-full rounded-lg border border-border bg-page p-3"
          />
        </label>
        <button
          disabled={busy || uploading}
          className="rounded-full bg-accent px-5 py-2 text-sm text-accent-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save profile"}
        </button>
        <p role="status" className="text-sm">
          {message}
        </p>
      </section>
      <section className="h-fit rounded-xl border border-border p-6">
        <h2 className="mb-4 text-lg font-semibold">Appearance</h2>
        <ThemeToggle />
      </section>
    </form>
  );
}
