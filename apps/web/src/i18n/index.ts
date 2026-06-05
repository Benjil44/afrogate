import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { en, type Dict } from './en';
import { fa } from './fa';

export type Lang = 'fa' | 'en';
export type { Dict };

const DICTS: Record<Lang, Dict> = { en, fa };

/** Where Login / Get-started send the user (the panel). Override with VITE_APP_URL. */
export const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) ?? 'https://app.afrows.com';

interface LangContextValue {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: Dict;
  setLang: (lang: Lang) => void;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue | null>(null);

function readInitialLang(): Lang {
  if (typeof localStorage === 'undefined') return 'fa';
  const stored = localStorage.getItem('afrows.lang');
  return stored === 'en' || stored === 'fa' ? stored : 'fa';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readInitialLang);
  const dir: 'rtl' | 'ltr' = lang === 'fa' ? 'rtl' : 'ltr';

  useEffect(() => {
    localStorage.setItem('afrows.lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const value: LangContextValue = {
    lang,
    dir,
    t: DICTS[lang],
    setLang,
    toggle: () => setLang(lang === 'fa' ? 'en' : 'fa'),
  };

  return createElement(LangContext.Provider, { value }, children);
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
