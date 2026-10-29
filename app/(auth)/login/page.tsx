import { safeNext } from "@/lib/safe-redirect";
import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ email?: string | string[]; next?: string | string[] }> }) {
  const { email, next } = await searchParams;
  return <LoginForm next={safeNext(next)} initialEmail={typeof email === "string" ? email.slice(0, 254) : ""} />;
}
