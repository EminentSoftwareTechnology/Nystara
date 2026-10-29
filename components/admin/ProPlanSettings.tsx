"use client";

import { useEffect, useState } from "react";
import { PRO_INTERVAL, PRO_PRICE } from "@/lib/plans";

type State = {
  proEnabled: boolean;
  updatedAt: string | null;
  stripe: { secretKey: boolean; priceId: boolean; webhookSecret: boolean };
  subscribers: number;
};

const CHECKS: { key: keyof State["stripe"]; label: string }[] = [
  { key: "secretKey", label: "STRIPE_SECRET_KEY" },
  { key: "priceId", label: "STRIPE_PRO_PRICE_ID" },
  { key: "webhookSecret", label: "STRIPE_WEBHOOK_SECRET" },
];

export default function ProPlanSettings() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/billing")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setState((await response.json()) as State);
      })
      .catch(() => setError("Could not load the Pro plan settings."));
  }, []);

  async function save(proEnabled: boolean) {
    const message = proEnabled
      ? `Launch Pro for everyone? Members without a subscription lose the AI editor, Pro themes, scheduling, listening and unlimited member stories until they pay ${PRO_PRICE}/${PRO_INTERVAL}.`
      : "Turn Pro off? Every member gets Pro features for free. Existing subscriptions keep billing until you cancel them in Stripe.";
    if (!window.confirm(message)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/billing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proEnabled }),
      });
      const body = (await response.json()) as State & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not save.");
      setState(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const ready = state ? Object.values(state.stripe).every(Boolean) : false;

  return (
    <div className="bg-background rounded-2xl border border-border p-6 mt-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-foreground mb-1">Nystara Pro</h2>
          <p className="text-sm text-muted max-w-md">
            While Pro is off, every member gets Pro features free and nothing is for sale. Launching Pro puts it on sale
            at {PRO_PRICE}/{PRO_INTERVAL} and limits Pro features to subscribers, worldwide.
          </p>
        </div>
        {state && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${state.proEnabled ? "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-300" : "bg-surface-2 text-muted"}`}
          >
            {state.proEnabled ? "Live" : "Off (free beta)"}
          </span>
        )}
      </div>

      {state && (
        <>
          <ul className="mt-5 grid gap-1.5 text-sm">
            {CHECKS.map(({ key, label }) => (
              <li key={key} className="flex items-center gap-2">
                <span className={state.stripe[key] ? "text-green-700 dark:text-green-400" : "text-danger"}>
                  {state.stripe[key] ? "Set" : "Missing"}
                </span>
                <code className="text-xs">{label}</code>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">
            {state.subscribers.toLocaleString()} active Pro {state.subscribers === 1 ? "subscriber" : "subscribers"}
            {state.updatedAt && <> · last changed {new Date(state.updatedAt).toLocaleString()}</>}
          </p>
          <div className="mt-5">
            {state.proEnabled ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => save(false)}
                className="px-5 py-2 rounded-full border border-border-strong text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Turn Pro off"}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !ready}
                onClick={() => save(true)}
                className="px-5 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Launch Pro"}
              </button>
            )}
            {!state.proEnabled && !ready && (
              <p className="mt-2 text-xs text-muted">Set the missing Stripe variables and redeploy to launch Pro.</p>
            )}
          </div>
        </>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
