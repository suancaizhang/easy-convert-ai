"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { TranslationKeys } from "@/i18n/types";
import zhCN from "@/i18n/zh-CN";
import en from "@/i18n/en";
import id from "@/i18n/id";
import vi from "@/i18n/vi";
import th from "@/i18n/th";
import fil from "@/i18n/fil";
import ms from "@/i18n/ms";

const LOCALES = ["zh-CN", "en", "id", "vi", "th", "fil", "ms"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh-CN";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = localStorage.getItem("locale");
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

const dictionaries: Record<Locale, TranslationKeys> = {
  "zh-CN": zhCN,
  en,
  id,
  vi,
  th,
  fil,
  ms,
};

function interpolate(
  text: string,
  params?: Record<string, string | number>
): string {
  if (!params) return text;
  let result = text;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }
  return result;
}

/**
 * Non-React translation helper — reads locale from localStorage.
 * Use in modules like api.ts that run outside the React tree.
 */
export function getTranslation(
  key: keyof TranslationKeys,
  params?: Record<string, string | number>
): string {
  const locale = readStoredLocale();
  const text = dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
  return interpolate(text, params);
}

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof TranslationKeys, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // The server and first client render must agree; restore browser-only state
  // after hydration without overwriting the saved selection.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
    document.documentElement.lang = l;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: keyof TranslationKeys, params?: Record<string, string | number>) => {
      const text =
        dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
      return interpolate(text, params);
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
