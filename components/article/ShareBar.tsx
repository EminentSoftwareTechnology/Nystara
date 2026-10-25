"use client";

import { useState } from "react";

type Props = { url: string; title: string };

const button =
  "flex h-10 w-10 items-center justify-center rounded-full border border-border bg-page text-foreground transition-colors hover:bg-surface";

function Glyph({ d }: { d: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d={d} />
    </svg>
  );
}

const FACEBOOK =
  "M9.1 23.7v-8H6.6V12h2.5v-1.6c0-4.1 1.8-6 5.9-6 .4 0 1 0 1.5.1.4 0 .8.1 1.1.2v3.3h-1.4c-.7 0-1.3.1-1.7.3-.3.1-.5.3-.7.6-.3.4-.4 1-.4 1.8V12h3.9l-.4 2.1-.3 1.6h-3.2V24C19.4 23.2 24 18.2 24 12c0-6.6-5.4-12-12-12S0 5.4 0 12c0 5.6 3.9 10.4 9.1 11.7Z";
const LINKEDIN =
  "M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z";
const X_LOGO =
  "M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41Z";
const DISCORD =
  "M20.32 4.37A19.8 19.8 0 0 0 15.43 2.85a.07.07 0 0 0-.08.04c-.21.37-.44.86-.6 1.25a18.3 18.3 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.88 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1 0 .13c-.6.35-1.22.65-1.88.89a.08.08 0 0 0-.04.11c.36.7.78 1.36 1.23 1.99a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.09-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42Z";

function InstagramGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden focusable="false">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden focusable="false">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}

export default function ShareBar({ url, title }: Props) {
  const [status, setStatus] = useState("");
  const encodedUrl = encodeURIComponent(url);
  const links = [
    { label: "Share on Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, icon: <Glyph d={FACEBOOK} /> },
    { label: "Share on LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, icon: <Glyph d={LINKEDIN} /> },
    { label: "Share on X", href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodeURIComponent(title)}`, icon: <Glyph d={X_LOGO} /> },
  ];

  // Instagram and Discord have no web share URL: use the device share sheet, or copy the link to paste in the app.
  async function shareToApp(app: string) {
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy(`Link copied. Paste it into ${app}.`);
  }

  async function copy(message = "Link copied.") {
    try {
      await navigator.clipboard.writeText(url);
      setStatus(message);
    } catch {
      setStatus("Couldn't copy. Copy the link from the address bar.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm text-muted">Share</span>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={link.label}
          title={link.label}
          className={button}
        >
          {link.icon}
        </a>
      ))}
      <button type="button" aria-label="Share on Instagram" title="Share on Instagram" className={button} onClick={() => void shareToApp("Instagram")}>
        <InstagramGlyph />
      </button>
      <button type="button" aria-label="Share on Discord" title="Share on Discord" className={button} onClick={() => void shareToApp("Discord")}>
        <Glyph d={DISCORD} />
      </button>
      <button type="button" aria-label="Copy link" title="Copy link" className={button} onClick={() => void copy()}>
        <LinkGlyph />
      </button>
      <span role="status" className="text-xs text-muted">
        {status}
      </span>
    </div>
  );
}
