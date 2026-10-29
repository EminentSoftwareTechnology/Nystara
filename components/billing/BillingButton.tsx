"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";

/** Starts Stripe Checkout or opens the Billing Portal, then follows the hosted URL. */
export default function BillingButton({
  action,
  label,
  variant = "primary",
  className,
}: {
  action: "checkout" | "portal";
  label: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/billing/${action}`, { method: "POST" });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? "Billing is unavailable. Please retry.");
      window.location.assign(body.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing is unavailable. Please retry.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={busy} onClick={go} className={buttonClass(variant, "lg", className)}>
        {busy ? "Opening Stripe…" : label}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
