"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, CARD } from "@/components/ui";

export default function SubmissionReview({
  id,
  submittedAt,
}: {
  id: string;
  submittedAt: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function review(published: boolean) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published }),
      });
      if (!response.ok)
        throw new Error("Could not complete this review. Please retry.");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not complete this review.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={`${CARD} mb-6 p-5`} aria-label="Submission review">
      <h2 className="font-semibold">Editorial review</h2>
      <p className="mt-1 text-sm text-muted">
        Submitted {new Date(submittedAt).toLocaleDateString("en-GB")}. Review
        the story below before publishing it or returning it to the
        writer&apos;s drafts.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => review(true)}
          disabled={busy}
          className={buttonClass("primary", "sm")}
        >
          Approve and publish
        </button>
        <button
          onClick={() => review(false)}
          disabled={busy}
          className={buttonClass("secondary", "sm")}
        >
          Return to draft
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
