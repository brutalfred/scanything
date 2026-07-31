import { useCallback, useEffect, useState } from "react";
import { applyTheme, isThemeKey, THEME_STORAGE_KEY, type ThemeKey } from "@/lib/theme";

const THEME_EVENT = "scanything:theme";

function readStoredTheme(): ThemeKey {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeKey(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "gold";
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeKey>("gold");

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
