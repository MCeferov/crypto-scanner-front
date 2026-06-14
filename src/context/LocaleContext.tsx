import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  createTranslator, DEFAULT_LOCALE, isValidLocale, type Locale, type TranslateFn,
} from '@workspace/i18n';

const STORAGE_KEY = 'app-locale';

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidLocale(stored)) return stored;
  } catch { /* ignore */ }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch('/api/i18n/locales').catch(() => {});
  }, []);

  const t = useMemo(() => createTranslator(locale), [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider');
  return ctx;
}

export function useT() {
  return useLocale().t;
}
