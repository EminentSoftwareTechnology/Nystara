// Plan constants shared by server and client code. Keep this module free of server imports.
export const PRO_PRICE = "$1.99";
export const PRO_INTERVAL = "month";
export const AI_DAILY_LIMIT = 30;

/** Story themes reserved for Pro writers. Stories already using one keep it. */
export const PRO_THEMES: readonly string[] = ["editorial", "elegant", "bold"];

export function isProTheme(theme: string): boolean {
  return PRO_THEMES.includes(theme);
}
