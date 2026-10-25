"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui";
export default function TopicButton({
  topicId,
  initialFollowing,
}: {
  topicId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/topics/${topicId}/follow`, {
        method: following ? "DELETE" : "PUT",
      });
      if (!response.ok) throw new Error("Could not save topic. Try again.");
      setFollowing(!following);
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not save topic.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        aria-pressed={following}
        className={buttonClass(following ? "secondary" : "primary", "sm")}
        onClick={() => void toggle()}
      >
        {busy ? "Saving…" : following ? "Following topic" : "Follow topic"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
