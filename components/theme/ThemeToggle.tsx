"use client";

import { MonitorIcon, MoonIcon, SandIcon, SunIcon } from "@/components/icons";
import type { Theme } from "@/lib/theme";
import { useTheme } from "./useTheme";

export const THEME_OPTIONS: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "sand", label: "Sand", Icon: SandIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

export function ThemeToggle() {
  const [theme, pick] = useTheme();

  return (
    <div role="group" aria-label="Theme" className="inline-flex items-center rounded-full border border-border p-0.5">
      {THEME_OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={`${label} theme`}
          aria-pressed={theme === value}
          onClick={() => pick(value)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground aria-pressed:bg-surface-2 aria-pressed:text-foreground"
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
