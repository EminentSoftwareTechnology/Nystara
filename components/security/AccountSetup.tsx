"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/icons";
import { INPUT, buttonClass, cx } from "@/components/ui";
import SecuritySettings from "./SecuritySettings";

type Props = {
  needsName: boolean;
  initialName: string;
  redirectTo: string;
};

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <span
          className={cx(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm",
            done ? "bg-accent text-accent-foreground" : "border border-border-strong text-muted",
          )}
        >
          {done ? <CheckIcon size={15} /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Required once per account: a display name, then a passkey or authenticator app, before anything else opens. */
export default function AccountSetup({ needsName, initialName, redirectTo }: Props) {
  const [name, setName] = useState(initialName);
  const [nameSaved, setNameSaved] = useState(!needsName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secured, setSecured] = useState(false);

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) setNameSaved(true);
    else setError("Couldn’t save your name. Please try again.");
  }

  return (
    <div className="flex flex-col gap-10">
      {needsName && (
        <Step n={1} done={nameSaved} title="Your display name">
          {nameSaved ? (
            <p className="text-sm text-muted">
              Readers will see you as <strong className="text-foreground">{name.trim()}</strong>.
            </p>
          ) : (
            <form onSubmit={saveName} className="flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="setup-name">
                Display name
              </label>
              <input
                id="setup-name"
                required
                maxLength={100}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How readers will see you"
                className={INPUT}
              />
              <button type="submit" disabled={busy || !name.trim()} className={buttonClass("primary", "md", "shrink-0")}>
                {busy ? "Saving…" : "Save name"}
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </Step>
      )}

      <Step n={needsName ? 2 : 1} done={secured} title="Protect your account">
        <p className="-mt-2 text-sm text-muted">
          Add a passkey (recommended) or an authenticator app. You’ll use it to confirm every new sign-in.
        </p>
        <SecuritySettings apiBase="/api/me/security" onReadyChange={setSecured} />
      </Step>

      <button
        type="button"
        disabled={!nameSaved || !secured}
        onClick={() => window.location.assign(redirectTo)}
        className={buttonClass("primary", "lg", "w-full")}
      >
        Continue to Nystara
      </button>
    </div>
  );
}
