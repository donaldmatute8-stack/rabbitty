'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'rabbitty_theme';

const THEME_COLORS: Record<ResolvedTheme, { background: string; header: string; meta: string }> = {
  dark: { background: '#0A0A0A', header: '#0A0A0A', meta: '#0A0A0A' },
  light: { background: '#F8F9FA', header: '#FFFFFF', meta: '#F8F9FA' },
};

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // ignore
  }
  return 'dark';
}

export function applyThemeToDocument(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('light', resolved === 'light');
  root.style.colorScheme = resolved;

  const colors = THEME_COLORS[resolved];

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', colors.meta);

  const tg = (window as unknown as { Telegram?: { WebApp?: Record<string, unknown> } }).Telegram?.WebApp as
    | { setBackgroundColor?: (c: string) => void; setHeaderColor?: (c: string) => void }
    | undefined;
  if (tg) {
    try {
      tg.setBackgroundColor?.(colors.background);
      tg.setHeaderColor?.(colors.header);
    } catch {
      // Telegram chrome is best-effort
    }
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');

  useEffect(() => {
    const stored = readStoredTheme();
    const resolved = stored === 'system' ? getSystemTheme() : stored;
    setThemeState(stored);
    setResolvedTheme(resolved);
    applyThemeToDocument(resolved);
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyThemeToDocument(resolved);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    const resolved = next === 'system' ? getSystemTheme() : next;
    setResolvedTheme(resolved);
    applyThemeToDocument(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, isDark: resolvedTheme === 'dark', setTheme, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
