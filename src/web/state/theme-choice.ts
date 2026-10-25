// Light or dark. HeyTerm starts on the light Gruvbox theme; Setup can pick dark or follow the system.
// public/theme-boot.js applies the same rule before the page draws, so it never flashes the wrong one.

export type ThemePreference = "light" | "dark" | "system";
export type Theme = "light" | "dark";

const preferences: ThemePreference[] = ["light", "dark", "system"];

export class ThemeChoice {
  static resolve(preference: ThemePreference | undefined, systemPrefersDark: boolean): Theme {
    const known = preference && preferences.includes(preference) ? preference : "light";
    if (known === "system") return systemPrefersDark ? "dark" : "light";
    return known;
  }

  // Every colour changes at once on a switch; with transitions on, the page smears through them.
  static apply(theme: Theme): void {
    const root = document.documentElement;
    if (root.dataset.theme === theme) return;
    const pause = document.createElement("style");
    pause.textContent = "*,*::before,*::after{transition:none !important}";
    document.head.appendChild(pause);
    root.dataset.theme = theme;
    void root.offsetHeight;
    requestAnimationFrame(() => pause.remove());
  }

  static systemPrefersDark(): boolean {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
}
