import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { en, type Dict } from './en';
import { fa } from './fa';

export type Lang = 'fa' | 'en';
export type { Dict };

const DICTS: Record<Lang, Dict> = { en, fa };
const STORAGE_KEY = 'afrows.lang';

/** Persian-first: fa is the default when nothing is stored. */
const DEFAULT_LANG: Lang = 'fa';

/** Language toggle is live (fa + en). */
export const WEB_LANGUAGE_TOGGLE_ENABLED = true;

/** Number locale per language — Persian digits and the `٬` thousands separator in fa. */
export const NUMBER_LOCALE: Record<Lang, string> = { fa: 'fa-IR', en: 'en-US' };

/** `m:ss` playback clock in the current language's digits. */
export function formatTime(seconds: number, lang: Lang): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const two = new Intl.NumberFormat(NUMBER_LOCALE[lang], { minimumIntegerDigits: 2, useGrouping: false });
  const one = new Intl.NumberFormat(NUMBER_LOCALE[lang], { useGrouping: false });
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${one.format(h)}:${two.format(m)}:${two.format(s)}` : `${one.format(m)}:${two.format(s)}`;
}

interface LangContextValue {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: Dict;
  setLang: (lang: Lang) => void;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue | null>(null);

function isLang(v: string | null): v is Lang {
  return v === 'en' || v === 'fa';
}

/** `?lang=en|fa` in the URL wins (shareable links), then the stored choice, then Persian. */
function readInitialLang(): Lang {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (isLang(fromUrl)) return fromUrl;
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLang(stored) ? stored : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [stored, setLang] = useState<Lang>(readInitialLang);
  const lang: Lang = WEB_LANGUAGE_TOGGLE_ENABLED ? stored : DEFAULT_LANG;
  const dir: 'rtl' | 'ltr' = lang === 'fa' ? 'rtl' : 'ltr';

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* private mode / blocked storage — the page still works */
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.title = DICTS[lang].documentTitle;
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
