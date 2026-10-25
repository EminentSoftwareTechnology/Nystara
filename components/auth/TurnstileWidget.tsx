"use client";

import { Turnstile } from "@marsidev/react-turnstile";

type Props = {
  onSuccess: (token: string) => void;
  onError?: () => void;
};

export default function TurnstileWidget({ onSuccess, onError }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || (process.env.NODE_ENV !== "production" ? "1x00000000000000000000AA" : "");

  return (
    <Turnstile
      siteKey={siteKey}
      onSuccess={onSuccess}
      onError={onError}
      options={{ theme: "auto" }}
    />
  );
}
