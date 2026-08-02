import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_EVENT,
  LANGUAGE_STORAGE_KEY,
  LANGUAGE_TAG,
  RTL_LANGUAGES,
  isLanguage,
  translateKey,
  type Language,
  type TranslationKey,
} from "@/lib/i18n";

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANGUAGE;
}

function applyDocumentLanguage(lang: Language) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = LANGUAGE_TAG[lang];
  document.documentElement.dir = RTL_LANGUAGES.includes(lang) ? "rtl" : "ltr";
}

/**
 * App-wide language. Persisted in localStorage and broadcast so every open
 * panel updates at once (same pattern as useTheme).
 */
export function useLanguage() {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    const sync = () => {
      const lang = readStoredLanguage();
      setLanguageState(lang);
      applyDocumentLanguage(lang);
    };
    sync();
    window.addEventListener(LANGUAGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LANGUAGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    applyDocumentLanguage(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(LANGUAGE_EVENT));
  }, []);

  const t = useCallback((key: TranslationKey) => translateKey(language, key), [language]);

  return useMemo(
    () => ({ language, setLanguage, t, isEnglish: language === "English" }),
    [language, setLanguage, t],
  );
}
