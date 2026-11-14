/** Apply checkout theme as CSS variables on an element. */

import { DEFAULT_THEME, type CheckoutTheme, type ColorScheme } from "./types.js";

export function themeFromPreferences(payload: Record<string, unknown>): CheckoutTheme {
  return {
    primary: stringOr(payload.primary_color, DEFAULT_THEME.primary),
    secondary: stringOr(payload.secondary_color, DEFAULT_THEME.secondary),
    accent: stringOr(payload.accent_color, DEFAULT_THEME.accent),
    background: stringOr(payload.background_color, DEFAULT_THEME.background),
  };
}

export function applyTheme(element: { style: { setProperty: (name: string, value: string) => void } }, theme: CheckoutTheme): void {
  element.style.setProperty("--mm-color-primary", theme.primary);
  element.style.setProperty("--mm-color-secondary", theme.secondary);
  element.style.setProperty("--mm-color-accent", theme.accent);
  element.style.setProperty("--mm-color-background", theme.background);
}

/** Sets `data-mm-theme` only; cheap and safe to call while the form has focus (no re-render). */
export function applyColorScheme(element: { setAttribute: (name: string, value: string) => void }, scheme: ColorScheme): void {
  element.setAttribute("data-mm-theme", scheme);
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}
