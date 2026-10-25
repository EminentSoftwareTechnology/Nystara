"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { EmailSent, OAuthButtons, OrDivider } from "@/components/auth/AuthParts";
import { INPUT, buttonClass } from "@/components/ui";

const TurnstileWidget = dynamic(() => import("@/components/auth/TurnstileWidget"), { ssr: false });

type State = "idle" | "loading" | "sent" | "error" | "account_exists";

export default function SignupForm({ initialEmail }: { initialEmail: string }) {
  const [name, setName] = useState("");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!turnstileToken) {
      fail("Please complete the CAPTCHA.");
      return;
    }
    setState("loading");
    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "signup", name, email, turnstileToken }),
    });
    if (res.ok) {
      setState("sent");
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    if (data.code === "account_exists") fail(data.error ?? "An account already uses this email address.", "account_exists");
    else fail(data.error ?? "Something went wrong.");
  }

  if (state === "sent") {
    return <EmailSent email={email}>Open it to finish creating your account.</EmailSent>;
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Create your account</h1>
        <p className="mt-2 text-sm text-muted">
          Already have one?{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>

      <OAuthButtons verb="Sign up" turnstileToken={turnstileToken} onError={(m) => fail(m)} />

      <OrDivider label="or sign up with email" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Display name
          <input
            required
            maxLength={100}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="How readers will see you"
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email address
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state === "account_exists") setState("idle");
            }}
            placeholder="you@example.com"
            className={INPUT}
          />
        </label>

        <div className="flex justify-center">
          <TurnstileWidget key={captchaKey} onSuccess={setTurnstileToken} onError={() => setTurnstileToken(null)} />
        </div>

        {state === "account_exists" && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
            <p>
              <strong>{email}</strong> already has a Nystara account.
            </p>
            <Link href={`/login?email=${encodeURIComponent(email)}`} className={buttonClass("primary", "sm", "self-start")}>
              Sign in instead
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
          disabled={state === "loading" || !turnstileToken || !name.trim()}
          className={buttonClass("primary", "md", "w-full rounded-xl")}
        >
          {state === "loading" ? "Sending…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-xs text-muted">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
