"use client";

import { type PublicKeyCredentialRequestOptionsJSON, startAuthentication } from "@simplewebauthn/browser";
import { useState } from "react";
import { buttonClass } from "@/components/ui";
import { type ClientProof, errorMessage, isCancelled, postJson } from "./api";

type Props = {
  methods: { totp: boolean; passkey: boolean };
  /** Returns `{ options }` for a passkey assertion. */
  optionsUrl: string;
  /** Accepts `{ proof }`. */
  verifyUrl: string;
  redirectTo: string;
};

const INPUT =
  "min-h-11 w-full rounded-xl border border-border bg-background px-3.5 text-base tracking-widest text-foreground placeholder:tracking-normal placeholder:text-muted focus:border-border-strong";

/** Second step of sign-in: a passkey, an authenticator code or a recovery code. */
export default function MfaChallenge({ methods, optionsUrl, verifyUrl, redirectTo }: Props) {
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(!methods.totp && !methods.passkey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify(proof: ClientProof) {
    const result = await postJson(verifyUrl, { proof });
    if (result.ok) {
      window.location.assign(redirectTo);
      return;
    }
    setError(errorMessage(result));
    setBusy(false);
  }

  async function withPasskey() {
    setBusy(true);
    setError("");
    const result = await postJson(optionsUrl);
    if (!result.ok || !result.data.options) {
      setError(errorMessage(result));
      setBusy(false);
      return;
    }
    try {
      const response = await startAuthentication({ optionsJSON: result.data.options as PublicKeyCredentialRequestOptionsJSON });
      await verify({ type: "passkey", response });
    } catch (e) {
      setError(isCancelled(e) ? "Passkey check was cancelled." : "That passkey couldn’t be used.");
      setBusy(false);
    }
  }

  async function withCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    await verify({ type: "code", code: code.trim() });
  }

  const showCode = methods.totp || useRecovery;

  return (
    <div className="flex flex-col gap-5">
      {methods.passkey && (
        <button type="button" onClick={withPasskey} disabled={busy} className={buttonClass("primary", "lg", "w-full")}>
          Use a passkey
        </button>
      )}

      {methods.passkey && showCode && (
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>
      )}

      {showCode && (
        <form onSubmit={withCode} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm font-medium">
            {useRecovery && !methods.totp ? "Recovery code" : useRecovery ? "Authenticator or recovery code" : "Authenticator code"}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode={useRecovery ? "text" : "numeric"}
              autoComplete="one-time-code"
              autoFocus={!methods.passkey}
              required
              maxLength={16}
              placeholder={useRecovery ? "xxxxx-xxxxx" : "123456"}
              className={INPUT}
            />
          </label>
          <button type="submit" disabled={busy || !code.trim()} className={buttonClass(methods.passkey ? "secondary" : "primary", "lg", "w-full")}>
            {busy ? "Checking…" : "Verify"}
          </button>
        </form>
      )}

      {!useRecovery && (
        <button type="button" onClick={() => setUseRecovery(true)} className="self-center text-sm text-muted underline underline-offset-4 hover:text-foreground">
          Use a recovery code instead
        </button>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
