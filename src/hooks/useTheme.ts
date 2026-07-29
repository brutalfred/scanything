import { useCallback, useEffect, useState } from "react";
import { applyTheme, isThemeKey, THEME_STORAGE_KEY, type ThemeKey } from "@/lib/theme";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeKey>("gold");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      stored = null;
    }
    const key: ThemeKey = isThemeKey(stored) ? stored : "gold";
    setThemeState(key);
    applyTheme(key);
  }, []);

  const setTheme = useCallback((key: ThemeKey) => {
    setThemeState(key);
    applyTheme(key);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, key);
    } catch {
      /* ignore */
    }
  }, []);

  return { theme, setTheme };
}
