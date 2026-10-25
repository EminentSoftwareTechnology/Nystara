"use client";

import { useEffect, useState } from "react";
import { type Theme, applyTheme, currentTheme } from "@/lib/theme";

/** The active theme, kept in sync with <html data-theme> so every switcher on the page agrees. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const update = () => setTheme(currentTheme());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    update();
    return () => observer.disconnect();
  }, []);

  function pick(next: Theme) {
    applyTheme(next);
    setTheme(next);
  }

  return [theme, pick];
}
