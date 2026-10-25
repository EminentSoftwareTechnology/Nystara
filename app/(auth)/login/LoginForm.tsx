"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import PasskeySignInButton from "@/components/security/PasskeySignInButton";
import { EmailSent, OAuthButtons, OrDivider } from "@/components/auth/AuthParts";
import { INPUT, buttonClass } from "@/components/ui";

const TurnstileWidget = dynamic(() => import("@/components/auth/TurnstileWidget"), { ssr: false });

type State = "idle" | "loading" | "sent" | "error" | "no_account";

export default function LoginForm({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Turnstile tokens are single-use: remount the widget for a fresh one after any rejected attempt.
  const [captchaKey, setCaptchaKey] = useState(0);
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function fail(message: string, next: State = "error") {
    setErrorMsg(message);
    setState(next);
    setTurnstileToken(null);
    setCaptchaKey((k) => k + 1);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!turnstileToken) {
      fail("Please complete the CAPTCHA.");
      return;
    }
    setState("loading");
    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "login", email, turnstileToken }),
    });
    if (res.ok) {
      setState("sent");
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    if (data.code === "no_account") fail(data.error ?? "No account uses this email address.", "no_account");
    else fail(data.error ?? "Something went wrong.");
  }

  if (state === "sent") {
    return <EmailSent email={email}>It expires in 10 minutes.</EmailSent>;
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Welcome back</h1>
        <p className="mt-2 text-sm text-muted">
          New to Nystara?{" "}
          <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>

      <PasskeySignInButton
        optionsUrl="/api/auth/passkey/options"
        verifyUrl="/api/auth/passkey/verify"
        redirectTo="/"
        className={buttonClass("primary", "md", "w-full rounded-xl")}
      />

      <OAuthButtons verb="Continue" turnstileToken={turnstileToken} onError={(m) => fail(m)} />

      <OrDivider label="or get a sign-in link by email" />

      <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email address
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state === "no_account") setState("idle");
            }}
            placeholder="you@example.com"
            className={INPUT}
          />
        </label>

        <div className="flex justify-center">
          <TurnstileWidget key={captchaKey} onSuccess={setTurnstileToken} onError={() => setTurnstileToken(null)} />
        </div>

        {state === "no_account" && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
            <p>
              <strong>{email}</strong> doesn’t have a Nystara account yet. Create one to get your sign-in link.
            </p>
            <Link href={`/signup?email=${encodeURIComponent(email)}`} className={buttonClass("primary", "sm", "self-start")}>
              Create an account
            </Link>
          </div>
        )}
        {state === "error" && (
          <p role="alert" className="text-sm text-danger">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={state === "loading" || !turnstileToken}
          className={buttonClass("secondary", "md", "w-full rounded-xl")}
        >
          {state === "loading" ? "Checking…" : "Email me a sign-in link"}
        </button>
      </form>
    </div>
  );
}
