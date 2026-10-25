// How the window is arranged, kept per browser: whether the sidebar and the conversation are folded,
// whether terminals sit in a grid or one at a time, and the theme.

import type { ThemePreference } from "./theme-choice.ts";

export type TerminalArrangement = "grid" | "focus";

export interface LayoutPreferences {
  sidebarCollapsed: boolean;
  conversationCollapsed: boolean;
  arrangement: TerminalArrangement;
  theme: ThemePreference;
}

const storageKey = "heyterm.layout";
const defaults: LayoutPreferences = { sidebarCollapsed: false, conversationCollapsed: false, arrangement: "grid", theme: "light" };

export function loadLayoutPreferences(): LayoutPreferences {
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Partial<LayoutPreferences>) };
  } catch {
    return defaults;
  }
}

export function saveLayoutPreferences(preferences: LayoutPreferences): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    // Not saving only means the layout resets on the next visit.
  }
}
