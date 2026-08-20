import { useEffect, useMemo, useState } from 'react';
import { en } from './i18n.en';
import { fa } from './i18n.fa';

export type DashboardLanguage = 'en' | 'fa';

const languageStorageKey = 'afrows.dashboard.language';

export const dashboardTranslations = {
  en,
  fa,
};

export type DashboardStrings = typeof en;

// Persian temporarily disabled: flip to true to restore the fa toggle everywhere.
export const LANGUAGE_TOGGLE_ENABLED = false;

export function useDashboardLanguage() {
  const [stored, setLanguage] = useState<DashboardLanguage>(loadInitialLanguage);
  const language: DashboardLanguage = LANGUAGE_TOGGLE_ENABLED ? stored : 'en';

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey, language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  }, [language]);

  return useMemo(() => {
    const nextLanguage: DashboardLanguage = !LANGUAGE_TOGGLE_ENABLED ? 'en' : language === 'fa' ? 'en' : 'fa';

    return {
      language,
      isRtl: language === 'fa',
      nextLanguage,
      setLanguage,
      strings: dashboardTranslations[language],
      languageToggleEnabled: LANGUAGE_TOGGLE_ENABLED,
    };
  }, [language]);
}

function loadInitialLanguage(): DashboardLanguage {
  // 1) Honor the language handed off from the landing site (?lang=en|fa).
  const param = new URLSearchParams(window.location.search).get('lang');
  if (param === 'en' || param === 'fa') return param;

  // 2) Otherwise the user's saved in-app choice.
  const savedLanguage = window.localStorage.getItem(languageStorageKey);
  if (savedLanguage === 'en' || savedLanguage === 'fa') return savedLanguage;

  // 3) Default to English.
  return 'en';
}

