"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Wordmark } from "@/components/brand/Logo";
import MfaChallenge from "@/components/security/MfaChallenge";
import PasskeySignInButton from "@/components/security/PasskeySignInButton";
import { buttonClass } from "@/components/ui";

const TurnstileWidget = dynamic(() => import("@/components/auth/TurnstileWidget"), { ssr: false });

type Methods = { totp: boolean; passkey: boolean };

const INPUT =
  "min-h-11 w-full rounded-xl border border-border bg-page px-3.5 text-sm text-foreground placeholder:text-muted focus:border-border-strong";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [mfa, setMfa] = useState<Methods | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!turnstileToken) {
      setErrorMsg("Please complete the CAPTCHA.");
      return;
    }
    setState("loading");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, turnstileToken }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; mfaRequired?: boolean; methods?: Methods };

    if (res.ok && data.mfaRequired && data.methods) {
      setMfa(data.methods);
      setState("idle");
    } else if (res.ok) {
      router.replace("/admin/dashboard");
    } else {
      setErrorMsg(data.error ?? "Login failed.");
      setState("error");
      setTurnstileToken(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-center gap-3">
            <Wordmark className="h-10" />
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted">Admin</span>
          </div>

          <div className="rounded-2xl border border-border bg-background p-6 sm:p-8">
            {mfa ? (
              <>
                <h1 className="mb-1 text-xl font-semibold tracking-tight">Verify it’s you</h1>
                <p className="mb-6 text-sm text-muted">Two-step verification is on for this admin account.</p>
                <MfaChallenge
                  methods={mfa}
                  optionsUrl="/api/admin/login/mfa-options"
                  verifyUrl="/api/admin/login/mfa"
                  redirectTo="/admin/dashboard"
                />
              </>
            ) : (
              <>
                <h1 className="mb-6 text-xl font-semibold tracking-tight">Sign in to admin</h1>

                <PasskeySignInButton
                  optionsUrl="/api/admin/login/passkey-options"
                  verifyUrl="/api/admin/login/passkey"
                  redirectTo="/admin/dashboard"
                  className={buttonClass("secondary", "md")}
                />

                <div className="my-6 flex items-center gap-3 text-xs text-muted">
                  <span className="h-px flex-1 bg-border" /> or use your password <span className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Email
                    <input
                      type="email"
                      required
                      autoComplete="username webauthn"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@nystara.com"
                      className={INPUT}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Password
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={INPUT}
                    />
                  </label>

                  <div className="flex justify-center">
                    <TurnstileWidget onSuccess={setTurnstileToken} onError={() => setTurnstileToken(null)} />
                  </div>

                  {state === "error" && (
                    <p role="alert" className="text-sm text-danger">
                      {errorMsg}
                    </p>
                  )}

                  <button type="submit" disabled={state === "loading" || !turnstileToken} className={buttonClass("primary", "md", "w-full")}>
                    {state === "loading" ? "Signing in…" : "Sign in"}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            <Link href="/" className="hover:text-foreground">
              ← Back to site
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
