// Keeps the page on the chosen theme, and on the system's while "System" is chosen.

import { useEffect, useState } from "react";
import { useHeyTermStore } from "./heyterm-store.ts";
import { ThemeChoice, type Theme } from "./theme-choice.ts";

export function useAppliedTheme(): Theme {
  const preference = useHeyTermStore((state) => state.layout.theme);
  const [systemPrefersDark, setSystemPrefersDark] = useState(ThemeChoice.systemPrefersDark);
  const theme = ThemeChoice.resolve(preference, systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemPrefersDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => ThemeChoice.apply(theme), [theme]);
  return theme;
}
