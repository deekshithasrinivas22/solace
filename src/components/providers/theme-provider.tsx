"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

export const solaceThemeOptions = [
  { id: "daydream", label: "Daydream", description: "Lavender, blush and butter", colors: ["#e8dcf8", "#f6dce8", "#fff0bf"] },
  { id: "peach-fizz", label: "Peach fizz", description: "Peach, apricot and cream", colors: ["#f8ddca", "#f3b9a6", "#fff1d7"] },
  { id: "blue-hour", label: "Blue hour", description: "Sky blue, periwinkle and cloud", colors: ["#dceafa", "#c6c9f1", "#f8f8ff"] },
  { id: "cherry-pop", label: "Cherry pop", description: "Petal pink, cherry and cream", colors: ["#f7d8e4", "#db678c", "#fff5e7"] },
  { id: "buttercup", label: "Buttercup", description: "Butter yellow, lavender and blush", colors: ["#f2e3a7", "#d9c7ee", "#f2cbd5"] },
] as const;

export type SolaceTheme = (typeof solaceThemeOptions)[number]["id"];

type ThemeContextValue = {
  theme: SolaceTheme;
  setTheme: (theme: SolaceTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_STORAGE_KEY = "solace-theme";
const defaultTheme: SolaceTheme = "daydream";
const themeListeners = new Set<() => void>();

function isSolaceTheme(value: string | null): value is SolaceTheme {
  return solaceThemeOptions.some((option) => option.id === value);
}

function getStoredTheme(): SolaceTheme {
  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isSolaceTheme(savedTheme) ? savedTheme : defaultTheme;
  } catch {
    return defaultTheme;
  }
}

function subscribeToTheme(listener: () => void) {
  themeListeners.add(listener);
  const handleStorage = () => listener();
  window.addEventListener("storage", handleStorage);
  return () => {
    themeListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme: SolaceTheme = useSyncExternalStore(subscribeToTheme, getStoredTheme, () => defaultTheme);

  useEffect(() => {
    document.documentElement.dataset.solaceTheme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Continue with the default palette if browser storage is unavailable.
    }
  }, [theme]);

  const setTheme = useCallback((nextTheme: SolaceTheme) => {
    document.documentElement.dataset.solaceTheme = nextTheme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The current page still changes theme if browser storage is unavailable.
    }
    themeListeners.forEach((listener) => listener());
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useSolaceTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useSolaceTheme must be used inside ThemeProvider.");
  return value;
}