import { isIP } from "node:net";

export function getClientIp(headers: Headers): string {
  // Enable only behind an ingress that appends/overwrites X-Forwarded-For and blocks direct traffic.
  if (process.env.TRUST_PROXY_IP !== "1") return "unknown";
  const value = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return value && isIP(value) ? value : "unknown";
}
