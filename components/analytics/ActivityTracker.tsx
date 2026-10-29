"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ActivityTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    let lastAttempt = 0;
    function record() {
      if (document.visibilityState !== "visible" || Date.now() - lastAttempt < 15 * 60_000) return;
      lastAttempt = Date.now();
      void fetch("/api/me/activity", { method: "POST" }).catch(() => { lastAttempt = 0; });
    }
    record();
    document.addEventListener("visibilitychange", record);
    document.addEventListener("pointerdown", record, { passive: true });
    document.addEventListener("keydown", record);
    return () => {
      document.removeEventListener("visibilitychange", record);
      document.removeEventListener("pointerdown", record);
      document.removeEventListener("keydown", record);
    };
  }, [pathname]);
  return null;
}
