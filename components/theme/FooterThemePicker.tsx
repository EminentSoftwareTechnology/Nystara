"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cx } from "@/components/ui";
import type { Theme } from "@/lib/theme";
import { THEME_OPTIONS } from "./ThemeToggle";
import { useTheme } from "./useTheme";

/** Footer theme menu: a compact trigger that opens upward, with a tick on the active theme. */
export function FooterThemePicker() {
  const [theme, applyPick] = useTheme();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const active = Math.max(0, THEME_OPTIONS.findIndex((o) => o.value === theme));
    items.current[active]?.focus();
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, theme]);

  function pick(value: Theme) {
    applyPick(value);
    setOpen(false);
    trigger.current?.focus();
  }

  function onMenuKey(event: React.KeyboardEvent) {
    const index = items.current.findIndex((el) => el === document.activeElement);
    const move = (to: number) => {
      event.preventDefault();
      items.current[(to + THEME_OPTIONS.length) % THEME_OPTIONS.length]?.focus();
    };
    if (event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowUp") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(THEME_OPTIONS.length - 1);
    else if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
      trigger.current?.focus();
    }
  }

  const current = THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[3];
  return (
    <div
      ref={root}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Theme: ${current.label}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border-strong px-3 text-xs text-foreground transition-colors hover:bg-surface-2"
      >
        <current.Icon size={14} />
        {current.label}
        <span aria-hidden className={cx("text-[10px] text-muted transition-transform", open && "rotate-180")}>
          ▾
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Theme"
          onKeyDown={onMenuKey}
          className="absolute bottom-11 left-1/2 z-20 w-44 -translate-x-1/2 rounded-xl border border-border-strong bg-page p-1 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35)] lg:left-auto lg:right-0 lg:translate-x-0"
        >
          {THEME_OPTIONS.map(({ value, label, Icon }, i) => (
            <button
              key={value}
              ref={(el) => {
                items.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              tabIndex={-1}
              aria-checked={theme === value}
              onClick={() => pick(value)}
              className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm hover:bg-surface aria-checked:bg-surface aria-checked:font-medium"
            >
              <Icon size={14} />
              <span className="flex-1">{label}</span>
              {theme === value && <span aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
