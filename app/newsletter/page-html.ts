const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "Content-Type": "text/html; charset=utf-8" };

/** Minimal standalone page for digest email links. `action` must already be URL-safe. */
export function newsletterPage(title: string, body: string, status: number, form?: { action: string; label: string }) {
  const button = form ? `<form method="post" action="${form.action}"><button type="submit" style="border:0;border-radius:999px;background:#14224a;color:#fff;padding:16px 24px;font-size:16px;cursor:pointer">${form.label}</button></form>` : "";
  return new Response(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nystara digest</title></head><body style="margin:0;background:#f7f7f4;color:#26251e;font:16px/1.7 Arial,sans-serif;padding:32px 16px"><main style="max-width:720px;margin:32px auto;border:1px solid #e6e5df;border-radius:24px;padding:32px;background:#fff"><a href="/" style="font:32px Georgia,serif;color:inherit;text-decoration:none">Nystara</a><h1 style="font:40px/1.2 Georgia,serif">${title}</h1><p>${body}</p>${button}<p><a href="/" style="color:#14224a">Read stories</a> · <a href="/privacy" style="color:#14224a">Privacy</a></p></main></body></html>`, { status, headers });
}
