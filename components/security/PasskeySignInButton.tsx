"use client";

import { type PublicKeyCredentialRequestOptionsJSON, startAuthentication } from "@simplewebauthn/browser";
import { useState } from "react";
import { cx } from "@/components/ui";
import { errorMessage, isCancelled, postJson } from "./api";

type Props = { optionsUrl: string; verifyUrl: string; redirectTo: string; className?: string };

function KeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.85 12.15 8.65-8.65M18 5l2 2M15 8l2 2" />
    </svg>
  );
}

/** Passwordless sign-in with a passkey saved on this device, a phone or a security key. */
export default function PasskeySignInButton({ optionsUrl, verifyUrl, redirectTo, className }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setBusy(true);
    setError("");
    const options = await postJson(optionsUrl);
    if (!options.ok) {
      setError(errorMessage(options));
      setBusy(false);
      return;
    }
    try {
      const response = await startAuthentication({ optionsJSON: options.data.options as PublicKeyCredentialRequestOptionsJSON });
      const result = await postJson(verifyUrl, { response });
      if (result.ok) {
        window.location.assign(redirectTo);
        return;
      }
      setError(errorMessage(result));
    } catch (e) {
      if (!isCancelled(e)) setError("That passkey couldn’t be used.");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={signIn} disabled={busy} className={cx("inline-flex w-full items-center justify-center gap-2 disabled:opacity-50", className)}>
        <KeyIcon />
        {busy ? "Waiting for passkey…" : "Sign in with a passkey"}
      </button>
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
