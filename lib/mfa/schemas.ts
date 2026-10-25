import { z } from "zod";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";

const b64url = z.string().min(1).max(8192).regex(/^[A-Za-z0-9_-]+$/);
const transport = z.enum(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]);
const attachment = z.enum(["platform", "cross-platform"]).optional();

const authenticationSchema = z.object({
  id: b64url,
  rawId: b64url,
  type: z.literal("public-key"),
  authenticatorAttachment: attachment,
  response: z.object({
    clientDataJSON: b64url,
    authenticatorData: b64url,
    signature: b64url,
    userHandle: b64url.optional(),
  }),
});

const registrationSchema = z.object({
  id: b64url,
  rawId: b64url,
  type: z.literal("public-key"),
  authenticatorAttachment: attachment,
  response: z.object({
    clientDataJSON: b64url,
    attestationObject: b64url,
    authenticatorData: b64url.optional(),
    publicKey: b64url.optional(),
    publicKeyAlgorithm: z.number().int().optional(),
    transports: z.array(transport).max(8).optional(),
  }),
});

// Extensions are not requested, so client extension results are dropped rather than trusted.
export const authenticationResponse = authenticationSchema.transform(
  (value): AuthenticationResponseJSON => ({ ...value, clientExtensionResults: {} }),
);

export const registrationResponse = registrationSchema.transform(
  (value): RegistrationResponseJSON => ({ ...value, clientExtensionResults: {} }),
);

/** A fresh second-factor check: an authenticator or recovery code, or a passkey assertion. */
export const proofSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("code"), code: z.string().trim().min(6).max(16) }),
  z.object({ type: z.literal("passkey"), response: authenticationResponse }),
]);

export type Proof = z.infer<typeof proofSchema>;
