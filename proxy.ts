import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminToken, getAdminTokenFromRequest } from "@/lib/admin-session";
import { isActiveAdmin } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";

import { isSameOriginWrite, readBody, PayloadTooLarge, BodyReadTimeout } from "@/lib/request";
import { contentSecurityPolicy } from "@/lib/csp";
const MINUTE = 60_000;
const CREDENTIAL_ENDPOINTS = new Set([
  "/api/admin/login",
  "/api/auth/magic-link",
  "/api/auth/oauth-turnstile",
]);
// Second-factor checks and factor changes get the strict tier: a 6-digit code must not be guessable.
const CREDENTIAL_PREFIXES = ["/api/auth/mfa/", "/api/auth/passkey/", "/api/admin/login/", "/api/me/security/", "/api/admin/security/"];

// Server-to-server callbacks that send no Origin header. Each must verify its own signature on the raw body.
const SIGNED_WEBHOOKS = new Set(["/api/stripe/webhook"]);

function isCredentialEndpoint(pathname: string): boolean {
  return CREDENTIAL_ENDPOINTS.has(pathname) || CREDENTIAL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function guardApi(req: NextRequest): Promise<NextResponse | null> {
  const { pathname } = req.nextUrl;
  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(req.method);

  if (isWrite) {
    if (!(req.method === "POST" && SIGNED_WEBHOOKS.has(pathname)) && !isSameOriginWrite(req)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Magic links must go through /api/auth/magic-link, which enforces Turnstile.
    if (["/api/auth/signin/resend", "/api/auth/signin/nodemailer"].includes(pathname)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const [tier, limit] = isCredentialEndpoint(pathname)
    ? ["credential", 10]
    : isWrite
      ? ["write", 60]
      : ["read", 300];
  const { ok, retryAfter } = await rateLimit(`${tier}:${getClientIp(req.headers)}`, limit, MINUTE);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  if (isWrite) {
    try {
      await readBody(req.clone());
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof PayloadTooLarge ? "Payload too large" : "Invalid body" },
        { status: error instanceof PayloadTooLarge ? 413 : error instanceof BodyReadTimeout ? 408 : 400 },
      );
    }
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
  if (pathname === "/api/health" && ["GET", "HEAD"].includes(req.method)) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    const response = await guardApi(req) ?? NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const { ok, retryAfter } = await rateLimit(`page:${getClientIp(req.headers)}`, 300, MINUTE);
  if (!ok) return new NextResponse("Too many requests", { status: 429, headers: { "Retry-After": String(retryAfter) } });

  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && pathname !== "/admin/login") {
    const response = await guardAdmin(req);
    if (response.status !== 200) {
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.delete("x-reader-id");
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  // Articles now require sign-in; expire the retired anonymous reader cookie.
  if (req.cookies.has("reader_session")) response.cookies.delete("reader_session");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
