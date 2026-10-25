import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sha256 } from "./crypto";

const COUNT = 10;
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function newCode(): string {
  const bytes = randomBytes(10);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

function hash(userId: string, code: string): string {
  return sha256(`${userId}:${code.trim().toLowerCase().replace(/\s+/g, "")}`);
}

export function looksLikeRecoveryCode(code: string): boolean {
  return /^[a-z0-9]{5}-?[a-z0-9]{5}$/i.test(code.trim());
}

/** Replaces any existing codes. The plaintext codes are returned once and never stored. */
export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: COUNT }, newCode);
  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({ data: codes.map((code) => ({ userId, codeHash: hash(userId, code) })) }),
  ]);
  return codes;
}

export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const normalized = code.trim().toLowerCase().replace(/^([a-z0-9]{5})([a-z0-9]{5})$/, "$1-$2");
  const { count } = await prisma.recoveryCode.updateMany({
    where: { userId, codeHash: hash(userId, normalized), usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}
