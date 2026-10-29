import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";

type SignIn = (input: { user: { email: string }; account?: { type: string }; email?: { verificationRequest: boolean } }) => Promise<boolean>;

function callback(synthetic: boolean): SignIn {
  let signIn: SignIn | undefined;
  const source = readFileSync(new URL("../lib/auth.ts", import.meta.url), "utf8");
  const { outputText } = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
  const require = createRequire(import.meta.url);
  const imports: Record<string, unknown> = {
    "next-auth": { default: (configure: (request: undefined) => { callbacks: { signIn: SignIn } }) => {
      signIn = configure(undefined).callbacks.signIn;
      return {};
    } },
    "@/lib/prisma": { prisma: { user: { findUnique: async () => ({ isSynthetic: synthetic }) } } },
    "@/lib/auth-adapter": { authAdapter: () => ({}) },
    "@/auth.config": { authConfig: { callbacks: {} } },
    "@/lib/email/notifications": {},
    "@/lib/oauth-turnstile": { verifyOAuthTurnstileToken: () => true },
  };
  runInNewContext(outputText, { exports: {}, require: (id: string) => id in imports ? imports[id] : require(id) });
  assert.ok(signIn);
  return signIn;
}

test("synthetic accounts cannot sign in by email or OAuth; ordinary accounts retain existing behavior", async () => {
  for (const synthetic of [true, false]) {
    const signIn = callback(synthetic);
    for (const input of [
      { user: { email: "amina.nystara@gmail.com" }, email: { verificationRequest: true } },
      { user: { email: "amina.nystara@gmail.com" }, account: { type: "oauth" } },
      { user: { email: "amina.nystara@gmail.com" } },
    ]) assert.equal(await signIn(input), !synthetic);
  }
});
