// =============================================================================
// Module: i18n — Configuration
// =============================================================================
// Layer 1 (Infrastructure)
// Purpose: Initialize i18next with bundled JSON translation resources.
//          Supports en (default), ko, ja. No HTTP backend — resources are
//          imported at build time to keep the app fully offline-capable.
// =============================================================================

import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import enTranslations from './locales/en.json'
import jaTranslations from './locales/ja.json'
import koTranslations from './locales/ko.json'

// Supported locale codes — add new entries here when expanding.
export const SUPPORTED_LANGUAGES = ['en', 'ko', 'ja'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'

// i18next resource map — single default namespace ('translation').
export const resources = {
  en: { translation: enTranslations },
  ko: { translation: koTranslations },
  ja: { translation: jaTranslations },
} as const

// Guard that ensures i18next is initialized at most once per process.
// In tests this module is re-imported per test file but i18next.isInitialized
// prevents duplicate initialization.
if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: {
      // React already escapes output — do not double-escape.
      escapeValue: false,
    },
    // Disable warnings for missing keys during tests.
    // In production a key missing from a non-English locale simply falls
    // back to English, which is acceptable.
    missingKeyNoValueFallbackToKey: true,
    returnNull: false,
  })
}

export default i18next
