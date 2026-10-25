"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/components/editor/upload-image";

export default function ImagePicker({ purpose, value, onChange, disabled, onUploading }: {
  purpose: "avatar" | "cover";
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  onUploading: (uploading: boolean) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const label = purpose === "avatar" ? "profile photo" : "article banner";
  const off = disabled || uploading;
  return <div className="space-y-3">
    <div className={purpose === "avatar" ? "flex items-center gap-4" : "space-y-3"}>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={purpose === "avatar" ? "Your profile photo" : "Article banner preview"} referrerPolicy="no-referrer" className={purpose === "avatar" ? "h-24 w-24 rounded-full border border-border object-cover" : "aspect-[16/7] w-full rounded-xl object-cover"} />
      ) : purpose === "avatar" ? <span aria-hidden="true" className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-surface text-3xl text-muted">＋</span> : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={off} onClick={() => file.current?.click()} className="min-h-11 rounded-full border border-border px-4 text-sm disabled:opacity-50">{uploading ? "Uploading…" : `${value ? "Replace" : "Upload"} ${label}`}</button>
        {value && <button type="button" disabled={off} onClick={() => { onChange(null); setError(""); }} className="min-h-11 px-2 text-sm underline disabled:opacity-50">Remove {label}</button>}
      </div>
    </div>
    <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Choose ${label}`} className="sr-only" disabled={off} onChange={async (event) => {
      const selected = event.target.files?.[0];
      if (!selected) return;
      setUploading(true);
      onUploading(true);
      setError("");
      try { onChange(await uploadImage(selected, purpose)); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed. Please retry."); }
      finally { setUploading(false); onUploading(false); if (file.current) file.current.value = ""; }
    }} />
    <p className="text-xs text-muted">JPEG, PNG or WebP up to 25 MB. {purpose === "avatar" ? "Shown as a circle. Save your profile to apply the change." : "Use a wide image. Save your story to apply the change."}</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </div>;
}
