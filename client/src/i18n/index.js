import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import km from './km.js';
import en from './en.js';

/**
 * i18n for the client. Every user-facing string comes from here (CLAUDE.md).
 *
 * This file is plain .js with no JSX, so it needs no Vite JSX handling — the
 * one component it exports is built with createElement.
 *
 * Usage:
 *   const t = useT();
 *   t('dashboard.welcome', { name: user.fullName })
 *
 *   const { language, setLanguage, toggleLanguage } = useLanguage();
 */

export const LANGUAGES = ['km', 'en'];
export const DEFAULT_LANGUAGE = 'km';

const dictionaries = { km, en };

const STORAGE_KEY = 'reanmate.language';

const LANGUAGE_LABELS = { km: 'ភាសាខ្មែរ', en: 'English' };
/** What the switcher shows: the language you'd get by tapping it. */
const SWITCH_LABELS = { km: 'EN', en: 'ខ្មែរ' };

export const isLanguage = (value) => LANGUAGES.includes(value);

/** localStorage throws in some privacy modes — never let that break the app. */
const readStoredLanguage = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
};

const writeStoredLanguage = (language) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Preference simply won't persist this session.
  }
};

/** Falls back to the device language, then Khmer. */
const detectLanguage = () => {
  const stored = readStoredLanguage();
  if (stored) return stored;

  try {
    const preferred = navigator.languages ?? [navigator.language];
    for (const tag of preferred) {
      const base = String(tag).toLowerCase().split('-')[0];
      if (isLanguage(base)) return base;
    }
  } catch {
    // Non-browser environment.
  }

  return DEFAULT_LANGUAGE;
};

const lookup = (dictionary, key) =>
  key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dictionary);

const KHMER_DIGITS = '០១២៣៤៥៦៧៨៩';

/**
 * Khmer text conventionally uses Khmer digits, and km.js writes them literally
 * ("១០–១៥ នាទី"), so interpolated numbers are converted to match. Without this,
 * one screen mixes "១០ នាទី" with "5 នាទី".
 *
 * Only values passed as JS numbers are converted — pass a string to opt out
 * (version numbers, codes, anything that must stay Western).
 */
export const formatNumber = (value, language) =>
  language === 'km'
    ? String(value).replace(/\d/g, (digit) => KHMER_DIGITS[Number(digit)])
    : String(value);

const interpolate = (template, vars, language) =>
  vars
    ? template.replace(/\{(\w+)\}/g, (match, name) => {
        if (!Object.hasOwn(vars, name)) return match;
        const value = vars[name];
        return typeof value === 'number' ? formatNumber(value, language) : String(value);
      })
    : template;

/**
 * Resolves a key outside React (axios interceptors, error mappers).
 *
 * Missing keys fall back to English rather than rendering blank, then to the
 * key itself — a visible `quiz.takeaways` in the UI is a bug report; an empty
 * div is not.
 */
export const translate = (language, key, vars) => {
  const primary = dictionaries[language] ?? dictionaries[DEFAULT_LANGUAGE];
  let value = lookup(primary, key);

  if (typeof value !== 'string') {
    const fallback = lookup(dictionaries.en, key);
    if (import.meta.env?.DEV) {
      console.warn(
        `[i18n] missing key "${key}" for "${language}"` +
          (typeof fallback === 'string' ? ' — using English' : ''),
      );
    }
    value = typeof fallback === 'string' ? fallback : key;
  }

  return interpolate(value, vars, language);
};

const I18nContext = createContext(null);

export const I18nProvider = ({ children, initialLanguage }) => {
  const [language, setLanguageState] = useState(
    () => (isLanguage(initialLanguage) ? initialLanguage : detectLanguage()),
  );

  // Keeps the persisted choice and <html lang> in step with state. The lang
  // attribute matters here: it drives Khmer font fallback and line breaking.
  useEffect(() => {
    writeStoredLanguage(language);
    try {
      document.documentElement.lang = language;
    } catch {
      // Non-browser environment.
    }
  }, [language]);

  const setLanguage = useCallback((next) => {
    if (!isLanguage(next)) {
      if (import.meta.env?.DEV) console.warn(`[i18n] ignoring unknown language "${next}"`);
      return;
    }
    setLanguageState(next);
  }, []);

  const toggleLanguage = useCallback(
    () => setLanguageState((current) => (current === 'km' ? 'en' : 'km')),
    [],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      languages: LANGUAGES,
      languageLabel: LANGUAGE_LABELS[language],
      t: (key, vars) => translate(language, key, vars),
    }),
    [language, setLanguage, toggleLanguage],
  );

  return createElement(I18nContext.Provider, { value }, children);
};

const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useT/useLanguage must be used inside <I18nProvider>');
  }
  return context;
};

/** The translate function for the active language. */
export const useT = () => useI18n().t;

/** The active language plus the persisted switcher controls. */
export const useLanguage = () => {
  const { language, setLanguage, toggleLanguage, languages, languageLabel } = useI18n();
  return { language, setLanguage, toggleLanguage, languages, languageLabel };
};

/**
 * Minimal switcher. Deliberately unstyled beyond a passed-in className — the
 * visual treatment comes from the screenshots when the UI lands.
 */
export const LanguageSwitcher = ({ className }) => {
  const { language, toggleLanguage } = useLanguage();

  return createElement(
    'button',
    {
      type: 'button',
      className,
      onClick: toggleLanguage,
      'aria-label': `Switch to ${LANGUAGE_LABELS[language === 'km' ? 'en' : 'km']}`,
      lang: language === 'km' ? 'en' : 'km',
    },
    SWITCH_LABELS[language],
  );
};
