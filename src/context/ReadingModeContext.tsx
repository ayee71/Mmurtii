import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ReadingThemeOption = 'default' | 'night' | 'sepia' | 'paper';
export type ReadingWidthOption = 'narrow' | 'standard' | 'wide';

export interface ReadingModePreferences {
  isReadingMode: boolean;
  readingTheme: ReadingThemeOption;
  readingWidth: ReadingWidthOption;
  fontScale: number;
  isBarCollapsed: boolean;
}

export const READING_MODE_STORAGE_KEY = 'seera_reading_mode_prefs_v1';

export const DEFAULT_READING_MODE_PREFS: ReadingModePreferences = {
  isReadingMode: false,
  readingTheme: 'default',
  readingWidth: 'standard',
  fontScale: 1.05,
  isBarCollapsed: false,
};

const VALID_THEMES: ReadonlySet<string> = new Set(['default', 'night', 'sepia', 'paper']);
const VALID_WIDTHS: ReadonlySet<string> = new Set(['narrow', 'standard', 'wide']);

export function clampFontScale(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return DEFAULT_READING_MODE_PREFS.fontScale;
  const rounded = Math.round(num * 20) / 20;
  return Math.min(1.35, Math.max(0.9, rounded));
}

export function sanitizeReadingModePrefs(raw: unknown): ReadingModePreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_READING_MODE_PREFS };
  }
  const obj = raw as Record<string, unknown>;
  return {
    isReadingMode: Boolean(obj.isReadingMode),
    readingTheme:
      typeof obj.readingTheme === 'string' && VALID_THEMES.has(obj.readingTheme)
        ? (obj.readingTheme as ReadingThemeOption)
        : DEFAULT_READING_MODE_PREFS.readingTheme,
    readingWidth:
      typeof obj.readingWidth === 'string' && VALID_WIDTHS.has(obj.readingWidth)
        ? (obj.readingWidth as ReadingWidthOption)
        : DEFAULT_READING_MODE_PREFS.readingWidth,
    fontScale: clampFontScale(obj.fontScale),
    isBarCollapsed: Boolean(obj.isBarCollapsed),
  };
}

export function loadReadingModePrefs(): ReadingModePreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_READING_MODE_PREFS };
  }
  try {
    const raw = window.localStorage.getItem(READING_MODE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_READING_MODE_PREFS };
    return sanitizeReadingModePrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_READING_MODE_PREFS };
  }
}

export function saveReadingModePrefs(prefs: ReadingModePreferences): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(READING_MODE_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or sandbox errors
  }
}

export function getReadingWidthClass(width: ReadingWidthOption): string {
  switch (width) {
    case 'narrow':
      return 'max-w-3xl';
    case 'wide':
      return 'max-w-7xl';
    case 'standard':
    default:
      return 'max-w-5xl';
  }
}

export function getReadingThemeContainerClass(theme: ReadingThemeOption): string {
  switch (theme) {
    case 'paper':
      return 'reading-surface-paper bg-[#FBF9F5] text-[#1C1917]';
    case 'sepia':
      return 'reading-surface-sepia bg-[#F5EFE2] text-[#292524]';
    case 'night':
      return 'reading-surface-night bg-[#090D16] text-[#F1F5F9]';
    case 'default':
    default:
      return 'bg-slate-950 text-slate-100';
  }
}

export interface ReadingModeContextValue extends ReadingModePreferences {
  toggleReadingMode: () => void;
  setReadingMode: (active: boolean) => void;
  enterReadingMode: () => void;
  exitReadingMode: () => void;
  setReadingTheme: (theme: ReadingThemeOption) => void;
  setReadingWidth: (width: ReadingWidthOption) => void;
  increaseFontScale: () => void;
  decreaseFontScale: () => void;
  resetFontScale: () => void;
  setBarCollapsed: (collapsed: boolean) => void;
}

const NOOP = () => {};

const DEFAULT_CONTEXT_VALUE: ReadingModeContextValue = {
  ...DEFAULT_READING_MODE_PREFS,
  toggleReadingMode: NOOP,
  setReadingMode: NOOP,
  enterReadingMode: NOOP,
  exitReadingMode: NOOP,
  setReadingTheme: NOOP,
  setReadingWidth: NOOP,
  increaseFontScale: NOOP,
  decreaseFontScale: NOOP,
  resetFontScale: NOOP,
  setBarCollapsed: NOOP,
};

const ReadingModeContext = createContext<ReadingModeContextValue>(DEFAULT_CONTEXT_VALUE);

export const ReadingModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<ReadingModePreferences>(() => loadReadingModePrefs());

  useEffect(() => {
    saveReadingModePrefs(prefs);
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.dataset.readingMode = prefs.isReadingMode ? 'true' : 'false';
      root.dataset.readingTheme = prefs.isReadingMode ? prefs.readingTheme : 'default';
      root.style.setProperty('--reading-font-scale', String(prefs.isReadingMode ? prefs.fontScale : 1));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('seera_reading_mode_changed', { detail: prefs }));
    }
  }, [prefs]);

  const setReadingMode = useCallback((active: boolean) => {
    setPrefs((prev) => ({
      ...prev,
      isReadingMode: active,
      isBarCollapsed: active ? false : prev.isBarCollapsed,
    }));
  }, []);

  const toggleReadingMode = useCallback(() => {
    setPrefs((prev) => ({
      ...prev,
      isReadingMode: !prev.isReadingMode,
      isBarCollapsed: false,
    }));
  }, []);

  const enterReadingMode = useCallback(() => setReadingMode(true), [setReadingMode]);
  const exitReadingMode = useCallback(() => {
    setReadingMode(false);
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [setReadingMode]);

  const setReadingTheme = useCallback((readingTheme: ReadingThemeOption) => {
    setPrefs((prev) => ({ ...prev, readingTheme }));
  }, []);

  const setReadingWidth = useCallback((readingWidth: ReadingWidthOption) => {
    setPrefs((prev) => ({ ...prev, readingWidth }));
  }, []);

  const increaseFontScale = useCallback(() => {
    setPrefs((prev) => ({ ...prev, fontScale: clampFontScale(prev.fontScale + 0.05) }));
  }, []);

  const decreaseFontScale = useCallback(() => {
    setPrefs((prev) => ({ ...prev, fontScale: clampFontScale(prev.fontScale - 0.05) }));
  }, []);

  const resetFontScale = useCallback(() => {
    setPrefs((prev) => ({ ...prev, fontScale: DEFAULT_READING_MODE_PREFS.fontScale }));
  }, []);

  const setBarCollapsed = useCallback((isBarCollapsed: boolean) => {
    setPrefs((prev) => ({ ...prev, isBarCollapsed }));
  }, []);

  return (
    <ReadingModeContext.Provider
      value={{
        ...prefs,
        toggleReadingMode,
        setReadingMode,
        enterReadingMode,
        exitReadingMode,
        setReadingTheme,
        setReadingWidth,
        increaseFontScale,
        decreaseFontScale,
        resetFontScale,
        setBarCollapsed,
      }}
    >
      {children}
    </ReadingModeContext.Provider>
  );
};

export function useReadingMode(): ReadingModeContextValue {
  return useContext(ReadingModeContext);
}
