import { useCallback, useEffect, useState } from "react";
import { applyTheme, isThemeKey, THEME_STORAGE_KEY, type ThemeKey } from "@/lib/theme";

const THEME_EVENT = "scanything:theme";
const DEFAULT_THEME: ThemeKey = "cyber";
/** One-time switch of every existing user over to the new default theme. */
const THEME_RESET_KEY = "scanything-theme-reset-cyber";

function readStoredTheme(): ThemeKey {
  try {
    if (!localStorage.getItem(THEME_RESET_KEY)) {
      localStorage.setItem(THEME_RESET_KEY, "1");
      localStorage.setItem(THEME_STORAGE_KEY, DEFAULT_THEME);
      return DEFAULT_THEME;
    }
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeKey(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeKey>(DEFAULT_THEME);

  useEffect(() => {
    const sync = () => {
      const key = readStoredTheme();
      setThemeState(key);
      applyTheme(key);
    };
    sync();
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setTheme = useCallback((key: ThemeKey) => {
    setThemeState(key);
    applyTheme(key);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, key);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return { theme, setTheme };
}
