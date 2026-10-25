"use client";

import {
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { useCallback, useEffect, useState } from "react";
import { CARD, buttonClass } from "@/components/ui";
import { type ApiResult, type ClientProof, errorMessage, isCancelled, postJson } from "./api";

type Status = {
  totpEnabled: boolean;
  mfaEnabled: boolean;
  recoveryRemaining: number;
  passkeys: { id: string; name: string; createdAt: string; lastUsedAt: string | null; backedUp: boolean }[];
};

type Enrollment = { secret: string; uri: string; qr: string };
type Confirm = { title: string; run: (proof: ClientProof) => Promise<void> };

const INPUT =
  "min-h-11 w-full rounded-xl border border-border bg-page px-3.5 text-base text-foreground placeholder:text-muted focus:border-border-strong";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Authenticator app, passkeys and recovery codes. `apiBase` is `/api/me/security` or `/api/admin/security`.
 * `onReadyChange` reports whether a second factor is on and any new recovery codes have been acknowledged.
 */
export default function SecuritySettings({
  apiBase,
  onReadyChange,
}: {
  apiBase: string;
  onReadyChange?: (ready: boolean) => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [passkeyName, setPasskeyName] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiBase, { cache: "no-store" });
    if (res.ok) setStatus((await res.json()) as Status);
    else setError("Couldn’t load your security settings.");
  }, [apiBase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  useEffect(() => {
    if (status) onReadyChange?.(status.mfaEnabled && !recoveryCodes);
  }, [status, recoveryCodes, onReadyChange]);

  function start() {
    setBusy(true);
    setError("");
    setNotice("");
  }

  async function finish(result: ApiResult, success: string): Promise<boolean> {
    setBusy(false);
    if (!result.ok) {
      setError(errorMessage(result));
      return false;
    }
    const codes = result.data.recoveryCodes;
    if (Array.isArray(codes)) setRecoveryCodes(codes.filter((c): c is string => typeof c === "string"));
    setNotice(success);
    setConfirm(null);
    await load();
    return true;
  }

  /** Runs `action` straight away when no second factor exists yet, otherwise after a fresh proof. */
  function guarded(title: string, action: (proof?: ClientProof) => Promise<void>) {
    if (status?.mfaEnabled) setConfirm({ title, run: (proof) => action(proof) });
    else void action();
  }

  async function setupTotp() {
    start();
    const result = await postJson(`${apiBase}/totp-setup`);
    setBusy(false);
    if (result.ok) setEnrollment(result.data as unknown as Enrollment);
    else setError(errorMessage(result));
  }

  function enableTotp(event: React.FormEvent) {
    event.preventDefault();
    guarded("Confirm turning on the authenticator app", async (proof) => {
      start();
      const ok = await finish(await postJson(`${apiBase}/totp-enable`, { code: totpCode, proof }), "Authenticator app is on.");
      if (ok) {
        setEnrollment(null);
        setTotpCode("");
      }
    });
  }

  function disableTotp() {
    setConfirm({
      title: "Confirm turning off the authenticator app",
      run: async (proof) => {
        start();
        await finish(await postJson(`${apiBase}/totp-disable`, { proof }), "Authenticator app is off.");
      },
    });
  }

  function addPasskey(event: React.FormEvent) {
    event.preventDefault();
    guarded("Confirm adding a passkey", async (proof) => {
      start();
      const options = await postJson(`${apiBase}/passkey-options`);
      if (!options.ok) {
        setBusy(false);
        setError(errorMessage(options));
        return;
      }
      try {
        const response = await startRegistration({ optionsJSON: options.data.options as PublicKeyCredentialCreationOptionsJSON });
        const ok = await finish(await postJson(`${apiBase}/passkey-register`, { name: passkeyName, response, proof }), "Passkey added.");
        if (ok) setPasskeyName("");
      } catch (e) {
        setBusy(false);
        setError(
          e instanceof Error && e.name === "InvalidStateError"
            ? "This device already has a passkey for your account."
            : isCancelled(e)
              ? "Passkey setup was cancelled."
              : "Passkey setup failed.",
        );
      }
    });
  }

  function removePasskey(id: string, name: string) {
    setConfirm({
      title: `Confirm removing “${name}”`,
      run: async (proof) => {
        start();
        await finish(await postJson(`${apiBase}/passkey-delete`, { id, proof }), "Passkey removed.");
      },
    });
  }

  function regenerateCodes() {
    setConfirm({
      title: "Confirm generating new recovery codes",
      run: async (proof) => {
        start();
        await finish(await postJson(`${apiBase}/recovery-regenerate`, { proof }), "New recovery codes generated. Your old codes no longer work.");
      },
    });
  }

  if (!status) {
    return <p className="text-sm text-muted">{error || "Loading…"}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {(error || notice) && (
        <p role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-danger text-danger" : "border-border bg-surface"}`}>
          {error || notice}
        </p>
      )}

      {confirm && (
        <ConfirmPanel
          apiBase={apiBase}
          title={confirm.title}
          onCancel={() => setConfirm(null)}
          onProof={confirm.run}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
        />
      )}

      {recoveryCodes && <RecoveryCodes codes={recoveryCodes} onDone={() => setRecoveryCodes(null)} />}

      <section className={`${CARD} flex flex-col gap-4 p-5 sm:p-6`}>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Two-step verification</h2>
            <p className="mt-1 text-sm text-muted">
              {status.mfaEnabled
                ? "On. You’ll confirm new sign-ins with a passkey or a code."
                : "Off. Add a passkey or an authenticator app to protect your account."}
            </p>
          </div>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.mfaEnabled ? "border-foreground" : "border-border text-muted"}`}>
            {status.mfaEnabled ? "Protected" : "Not set up"}
          </span>
        </header>
      </section>

      <section className={`${CARD} flex flex-col gap-4 p-5 sm:p-6`}>
        <header>
          <h2 className="font-semibold">Passkeys</h2>
          <p className="mt-1 text-sm text-muted">
            Sign in with your fingerprint, face or device PIN. Passkeys can’t be phished and work as both your sign-in and your second step.
          </p>
        </header>
        {status.passkeys.length > 0 && (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {status.passkeys.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted">
                    Added {formatDate(p.createdAt)}
                    {p.lastUsedAt ? ` · Last used ${formatDate(p.lastUsedAt)}` : " · Never used"}
                    {p.backedUp ? " · Synced" : ""}
                  </p>
                </div>
                <button type="button" onClick={() => removePasskey(p.id, p.name)} disabled={busy} className={buttonClass("ghost", "sm", "text-danger")}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addPasskey} className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="passkey-name">
            Passkey name
          </label>
          <input
            id="passkey-name"
            value={passkeyName}
            onChange={(e) => setPasskeyName(e.target.value)}
            required
            maxLength={60}
            placeholder="Name, e.g. MacBook Touch ID"
            className={INPUT}
          />
          <button type="submit" disabled={busy || !passkeyName.trim()} className={buttonClass("primary", "md", "shrink-0")}>
            Add a passkey
          </button>
        </form>
      </section>

      <section className={`${CARD} flex flex-col gap-4 p-5 sm:p-6`}>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Authenticator app</h2>
            <p className="mt-1 text-sm text-muted">Use 6-digit codes from an app such as 1Password, Google Authenticator or Authy.</p>
          </div>
          {status.totpEnabled ? (
            <button type="button" onClick={disableTotp} disabled={busy} className={buttonClass("secondary", "sm")}>
              Turn off
            </button>
          ) : (
            !enrollment && (
              <button type="button" onClick={setupTotp} disabled={busy} className={buttonClass("primary", "sm")}>
                Set up
              </button>
            )
          )}
        </header>
        {status.totpEnabled && <p className="text-sm">On</p>}
        {enrollment && !status.totpEnabled && (
          <form onSubmit={enableTotp} className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated by the server */}
            <img src={enrollment.qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-xl border border-border bg-white p-2" />
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">Scan the code with your app, or enter this key manually:</p>
              <code className="break-all rounded-lg bg-surface px-3 py-2 font-mono text-sm">{enrollment.secret}</code>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Code from the app
                <input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  placeholder="123456"
                  className={`${INPUT} tracking-widest`}
                />
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={busy || totpCode.length !== 6} className={buttonClass("primary", "md")}>
                  Turn on
                </button>
                <button type="button" onClick={() => setEnrollment(null)} className={buttonClass("ghost", "md")}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      {status.mfaEnabled && (
        <section className={`${CARD} flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6`}>
          <div>
            <h2 className="font-semibold">Recovery codes</h2>
            <p className="mt-1 text-sm text-muted">
              One-time codes for when you can’t use your passkey or app. {status.recoveryRemaining} of 10 left.
            </p>
          </div>
          <button type="button" onClick={regenerateCodes} disabled={busy} className={buttonClass("secondary", "sm")}>
            Generate new codes
          </button>
        </section>
      )}
    </div>
  );
}

function ConfirmPanel({
  apiBase,
  title,
  onCancel,
  onProof,
  busy,
  setBusy,
  setError,
}: {
  apiBase: string;
  title: string;
  onCancel: () => void;
  onProof: (proof: ClientProof) => Promise<void>;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setError: (error: string) => void;
}) {
  const [code, setCode] = useState("");

  async function withPasskey() {
    setBusy(true);
    setError("");
    const result = await postJson(`${apiBase}/proof-options`);
    const options = result.data.options;
    if (!result.ok || !options) {
      setBusy(false);
      setError(result.ok ? "You don’t have a passkey yet. Use a code instead." : errorMessage(result));
      return;
    }
    try {
      const response = await startAuthentication({ optionsJSON: options as PublicKeyCredentialRequestOptionsJSON });
      await onProof({ type: "passkey", response });
    } catch (e) {
      setBusy(false);
      setError(isCancelled(e) ? "Passkey check was cancelled." : "That passkey couldn’t be used.");
    }
  }

  return (
    <section aria-label="Confirm it’s you" className="flex flex-col gap-4 rounded-2xl border border-border-strong bg-page p-5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.35)] sm:p-6">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted">Use a passkey, an authenticator code or a recovery code.</p>
      </div>
      <button type="button" onClick={withPasskey} disabled={busy} className={buttonClass("primary", "md", "self-start")}>
        Use a passkey
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onProof({ type: "code", code: code.trim() });
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label className="sr-only" htmlFor="confirm-code">
          Authenticator or recovery code
        </label>
        <input
          id="confirm-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
          maxLength={16}
          placeholder="Authenticator or recovery code"
          className={INPUT}
        />
        <div className="flex gap-2">
          <button type="submit" disabled={busy || code.trim().length < 6} className={buttonClass("secondary", "md")}>
            Confirm
          </button>
          <button type="button" onClick={onCancel} className={buttonClass("ghost", "md")}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = codes.join("\n");
  function download() {
    const url = URL.createObjectURL(new Blob([`Nystara recovery codes\n\n${text}\n`], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "nystara-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-label="Recovery codes" className="flex flex-col gap-4 rounded-2xl border border-border-strong bg-page p-5 sm:p-6">
      <div>
        <h2 className="font-semibold">Save your recovery codes</h2>
        <p className="mt-1 text-sm text-muted">
          Each code works once. Store them somewhere safe, like a password manager. You won’t see them again.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-4 font-mono text-sm sm:grid-cols-5">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void navigator.clipboard.writeText(text)} className={buttonClass("secondary", "sm")}>
          Copy
        </button>
        <button type="button" onClick={download} className={buttonClass("secondary", "sm")}>
          Download
        </button>
        <button type="button" onClick={onDone} className={buttonClass("primary", "sm")}>
          I’ve saved them
        </button>
      </div>
    </section>
  );
}
