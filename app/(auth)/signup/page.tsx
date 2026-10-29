import { safeNext } from "@/lib/safe-redirect";
import type { Metadata } from "next";
import SignupForm from "./SignupForm";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ email?: string | string[]; next?: string | string[] }> }) {
  const { email, next } = await searchParams;
  return <SignupForm next={safeNext(next)} initialEmail={typeof email === "string" ? email.slice(0, 254) : ""} />;
}
