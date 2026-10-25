"use client";

import { useState } from "react";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import { INPUT, buttonClass } from "@/components/ui";

const FREQUENCIES = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
] as const;

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]["value"]>("WEEKLY");
  const [token, setToken] = useState("");
  const [widget, setWidget] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  if (done) return <p role="status" className="text-sm text-muted">{message}</p>;

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          const response = await fetch("/api/newsletter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, frequency, turnstileToken: token }),
          });
          const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
          if (response.ok) {
            setDone(true);
            setMessage(body.message ?? "Check your inbox to confirm.");
          } else {
            setMessage(body.error ?? "Couldn't subscribe. Please retry.");
            // Turnstile tokens are single use.
            setToken("");
            setWidget((value) => value + 1);
          }
        } catch {
          setMessage("Couldn't connect. Please retry.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Get the digest</h2>
      <p className="text-sm text-muted">New, most-read and trending stories in your inbox.</p>
      <label className="sr-only" htmlFor="newsletter-email">Email address</label>
      <input id="newsletter-email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className={INPUT} />
      <fieldset className="flex flex-wrap justify-center gap-2 lg:justify-start">
        <legend className="sr-only">How often</legend>
        {FREQUENCIES.map((option) => (
          <label key={option.value} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-border-strong ${frequency === option.value ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}>
            <input type="radio" name="newsletter-frequency" value={option.value} checked={frequency === option.value} onChange={() => setFrequency(option.value)} className="sr-only" />
            {option.label}
          </label>
        ))}
      </fieldset>
      {email.length > 0 && <TurnstileWidget key={widget} onSuccess={setToken} onError={() => setToken("")} />}
      <button type="submit" disabled={busy || !token} className={buttonClass("primary", "md")}>
        {busy ? "Subscribing…" : "Subscribe"}
      </button>
      <p role="status" className="text-sm text-muted">{message}</p>
    </form>
  );
}
