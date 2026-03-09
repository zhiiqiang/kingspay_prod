import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { messages, SupportedLocale } from './messages';

type LanguageContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'kp-language';
const DEFAULT_LOCALE: SupportedLocale = 'en';

const getInitialLocale = (): SupportedLocale => {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  const storedLocale = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (storedLocale === 'en' || storedLocale === 'id') {
    return storedLocale;
  }

  const browserLocale = window.navigator.language.toLowerCase();
  if (browserLocale.startsWith('id')) {
    return 'id';
  }

  return DEFAULT_LOCALE;
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => getInitialLocale());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = (nextLocale: SupportedLocale) => {
    setLocaleState(nextLocale);
  };

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: string) => messages[locale][key] ?? key,
    }),
    [locale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
};
