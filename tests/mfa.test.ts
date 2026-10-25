import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { Secret, TOTP } from "otpauth";
import { decryptSecret, encryptSecret } from "../lib/mfa/crypto";
import { newTotpSecret, verifyTotp } from "../lib/mfa/totp";
import { looksLikeRecoveryCode } from "../lib/mfa/recovery";
import { authenticationResponse, proofSchema, registrationResponse } from "../lib/mfa/schemas";
import { safeNext } from "../lib/safe-redirect";

process.env.MFA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.DATABASE_URL ??= "postgresql://unused:unused@127.0.0.1:1/unused";

function currentCode(secret: string, offsetSteps = 0) {
  const totp = new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30, algorithm: "SHA1" });
  return totp.generate({ timestamp: Date.now() + offsetSteps * 30_000 });
}

test("TOTP secrets round-trip, are randomised and are bound to their account", () => {
  const secret = newTotpSecret();
  const sealed = encryptSecret(secret, "user-a");
  assert.notEqual(sealed, encryptSecret(secret, "user-a"));
  assert.ok(!sealed.includes(secret));
  assert.equal(decryptSecret(sealed, "user-a"), secret);
  assert.throws(() => decryptSecret(sealed, "user-b"));
  const [v, iv, tag, data] = sealed.split(".");
  const flipped = data.slice(0, -2) + (data.at(-2) === "A" ? "B" : "A") + data.at(-1);
  assert.throws(() => decryptSecret([v, iv, tag, flipped].join("."), "user-a"));
});

test("encryption refuses a missing or short key", () => {
  const saved = process.env.MFA_ENCRYPTION_KEY;
  process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
  assert.throws(() => encryptSecret("x", "u"), /MFA_ENCRYPTION_KEY/);
  delete process.env.MFA_ENCRYPTION_KEY;
  assert.throws(() => encryptSecret("x", "u"), /MFA_ENCRYPTION_KEY/);
  process.env.MFA_ENCRYPTION_KEY = saved;
});

test("TOTP accepts the current code once and blocks replay of it or older steps", () => {
  const secret = newTotpSecret();
  const step = verifyTotp(secret, currentCode(secret), null);
  assert.equal(typeof step, "number");
  assert.equal(verifyTotp(secret, currentCode(secret), step), null);
  assert.equal(verifyTotp(secret, currentCode(secret, -1), step), null);
  assert.equal(verifyTotp(secret, currentCode(secret, 1), step), (step ?? 0) + 1);
});

test("TOTP rejects malformed, wrong and far-drifted codes", () => {
  const secret = newTotpSecret();
  for (const code of ["", "12345", "1234567", "abcdef", " 123456"]) assert.equal(verifyTotp(secret, code, null), null);
  assert.equal(verifyTotp(secret, currentCode(secret, 3), null), null);
  assert.equal(verifyTotp(secret, currentCode(newTotpSecret()), null), null);
});

test("recovery code format check", () => {
  assert.ok(looksLikeRecoveryCode("abcde-fgh23"));
  assert.ok(looksLikeRecoveryCode("ABCDEFGH23"));
  assert.ok(!looksLikeRecoveryCode("123456"));
  assert.ok(!looksLikeRecoveryCode("abcde-fgh23-extra"));
});

test("post-sign-in redirects stay on this site", () => {
  assert.equal(safeNext("/me/stories"), "/me/stories");
  for (const bad of [undefined, "", "https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)"]) {
    assert.equal(safeNext(bad), "/");
  }
  assert.equal(safeNext(["/a", "/b"]), "/a");
});

test("WebAuthn payloads are strictly validated and client extension results are dropped", () => {
  const assertion = {
    id: "abc", rawId: "abc", type: "public-key",
    response: { clientDataJSON: "e30", authenticatorData: "AA", signature: "AA" },
    clientExtensionResults: { evil: true },
  };
  const parsed = authenticationResponse.parse(assertion);
  assert.deepEqual(parsed.clientExtensionResults, {});
  assert.equal(authenticationResponse.safeParse({ ...assertion, type: "password" }).success, false);
  assert.equal(authenticationResponse.safeParse({ ...assertion, id: "not base64url!" }).success, false);
  assert.equal(
    registrationResponse.safeParse({ ...assertion, response: { clientDataJSON: "e30", attestationObject: "AA", transports: ["telepathy"] } }).success,
    false,
  );
  assert.equal(proofSchema.safeParse({ type: "code", code: "123" }).success, false);
  assert.equal(proofSchema.safeParse({ type: "code", code: "123456" }).success, true);
  assert.equal(proofSchema.safeParse({ type: "magic" }).success, false);
});
