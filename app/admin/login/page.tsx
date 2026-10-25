"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { DarkWordmark } from "@/components/brand/Logo";

const TurnstileWidget = dynamic(() => import("@/components/auth/TurnstileWidget"), { ssr: false });

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

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

    if (res.ok) {
      router.replace("/admin/dashboard");
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErrorMsg(data.error ?? "Login failed.");
      setState("error");
      setTurnstileToken(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-2 mb-8">
            <DarkWordmark className="h-10" />
            <span className="text-gray-400 font-medium text-sm">Admin</span>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8">
            <h1 className="text-white text-xl font-semibold mb-6">Sign in to admin</h1>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@techscribe.io"
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>

              <div className="flex justify-center">
                <TurnstileWidget onSuccess={setTurnstileToken} onError={() => setTurnstileToken(null)} />
              </div>

              {state === "error" && (
                <p className="text-sm text-red-400">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={state === "loading" || !turnstileToken}
                className="w-full py-2.5 rounded-lg bg-white text-gray-900 text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {state === "loading" ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-gray-500">
            <Link href="/" className="hover:text-gray-400">← Back to site</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
