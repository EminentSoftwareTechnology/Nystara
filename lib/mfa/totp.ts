import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";

const ISSUER = "Nystara";
const PERIOD = 30;

function totp(secret: string, label: string) {
  return new TOTP({ issuer: ISSUER, label, algorithm: "SHA1", digits: 6, period: PERIOD, secret: Secret.fromBase32(secret) });
}

export function newTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export async function totpEnrollment(secret: string, label: string) {
  const uri = totp(secret, label).toString();
  return { secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
}

/** Returns the matched time step (to block replays), or null. Accepts one step of clock drift either way. */
export function verifyTotp(secret: string, code: string, lastStep: number | null): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const delta = totp(secret, "").validate({ token: code, window: 1 });
  if (delta === null) return null;
  const step = Math.floor(Date.now() / 1000 / PERIOD) + delta;
  return lastStep !== null && step <= lastStep ? null : step;
}
