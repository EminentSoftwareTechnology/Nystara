"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteArticleButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this article permanently?")) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/articles/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/articles");
    } else {
      alert("Delete failed.");
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
