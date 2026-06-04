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

export function useDashboardLanguage() {
  const [language, setLanguage] = useState<DashboardLanguage>(loadInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey, language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  }, [language]);

  return useMemo(() => {
    const nextLanguage: DashboardLanguage = language === 'fa' ? 'en' : 'fa';

    return {
      language,
      isRtl: language === 'fa',
      nextLanguage,
      setLanguage,
      strings: dashboardTranslations[language],
    };
  }, [language]);
}

function loadInitialLanguage(): DashboardLanguage {
  const savedLanguage = window.localStorage.getItem(languageStorageKey);
  if (savedLanguage === 'en' || savedLanguage === 'fa') return savedLanguage;

  const browserLanguages = window.navigator.languages.length > 0 ? window.navigator.languages : [window.navigator.language];
  return browserLanguages.some((language) => language.toLowerCase().startsWith('fa')) ? 'fa' : 'en';
}

