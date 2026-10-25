"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui";

export default function FollowButton({
  writerId,
  initialFollowing = false,
}: {
  writerId: string;
  initialFollowing?: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/users/${writerId}/follow`, {
        method: following ? "DELETE" : "PUT",
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok)
        throw new Error("Could not update follow. Please try again.");
      setFollowing(!following);
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not update follow.",
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
        onClick={() => void toggle()}
        className={buttonClass(following ? "secondary" : "primary", "sm")}
      >
        {busy ? "Saving…" : following ? "Following" : "Follow"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
