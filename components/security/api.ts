import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";

export type ClientProof = { type: "code"; code: string } | { type: "passkey"; response: AuthenticationResponseJSON };

export type ApiResult = { ok: boolean; status: number; data: Record<string, unknown> };

export async function postJson(url: string, body: unknown = {}): Promise<ApiResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data && typeof data === "object" ? (data as Record<string, unknown>) : {} };
}

export function errorMessage(result: ApiResult, fallback = "Something went wrong. Please try again."): string {
  return typeof result.data.error === "string" ? result.data.error : fallback;
}

/** Browser WebAuthn errors when the person cancels or the prompt times out; not worth an alarming message. */
export function isCancelled(error: unknown): boolean {
  return error instanceof Error && (error.name === "NotAllowedError" || error.name === "AbortError");
}
