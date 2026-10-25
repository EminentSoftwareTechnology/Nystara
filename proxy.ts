import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminToken, getAdminTokenFromRequest } from "@/lib/admin-session";
import { isActiveAdmin } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 1024 * 1024;
const MINUTE = 60_000;
const CREDENTIAL_ENDPOINTS = new Set([
  "/api/admin/login",
  "/api/auth/magic-link",
  "/api/auth/oauth-turnstile",
]);

function isSameOrigin(req: NextRequest, origin: string): boolean {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

function guardApi(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(req.method);

  if (isWrite) {
    // Browsers always send Origin on cross-site writes, so a mismatch means CSRF.
    const origin = req.headers.get("origin");
    if (origin && !isSameOrigin(req, origin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    // Magic links must go through /api/auth/magic-link, which enforces Turnstile.
    if (pathname === "/api/auth/signin/resend") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const [tier, limit] = CREDENTIAL_ENDPOINTS.has(pathname)
    ? ["credential", 10]
    : isWrite
      ? ["write", 60]
      : ["read", 300];
  const { ok, retryAfter } = rateLimit(`${tier}:${getClientIp(req.headers)}`, limit, MINUTE);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  return null;
}

async function guardAdmin(req: NextRequest): Promise<NextResponse> {
  const token = getAdminTokenFromRequest(req);
  const payload = token ? await verifyAdminToken(token) : null;
  if (!payload || !(await isActiveAdmin(payload))) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  return NextResponse.next();
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    return guardApi(req) ?? NextResponse.next();
  }
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    return guardAdmin(req);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*"],
};
