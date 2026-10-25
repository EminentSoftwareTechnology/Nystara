export const THEMES = ["light", "dark", "sand", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type ExplicitTheme = Exclude<Theme, "system">;

export function isExplicitTheme(value: string | undefined | null): value is ExplicitTheme {
  return value === "light" || value === "dark" || value === "sand";
}

/** Reads the active theme from the <html data-theme> attribute the server rendered. */
export function currentTheme(): Theme {
  const value = document.documentElement.getAttribute("data-theme");
  return isExplicitTheme(value) ? value : "system";
}

/** Applies the theme now and stores it in the `theme` cookie, which the root layout reads on the next request. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax${secure}`;
}
