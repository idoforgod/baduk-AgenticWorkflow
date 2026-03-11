// =============================================================================
// Module: i18n — useLanguage Hook
// =============================================================================
// Purpose: Exposes the current language, a setter that persists to
//          localStorage, and the list of supported languages.
//          Language detection order:
//            1. localStorage (user's prior explicit choice)
//            2. navigator.language prefix (system language)
//            3. DEFAULT_LANGUAGE ('en')
// =============================================================================

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import './config'
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from './config'

const STORAGE_KEY = 'baduk-language'

/**
 * Detect the best initial language from localStorage / system.
 * Returns a SupportedLanguage code. Pure function — safe to call outside
 * React context.
 */
export function detectInitialLanguage(): SupportedLanguage {
  // 1. Previously persisted choice.
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
      return stored as SupportedLanguage
    }
  } catch {
    // localStorage may be unavailable (SSR, sandboxed, privacy mode).
  }

  // 2. Browser/system language — match the language prefix (e.g. 'ko-KR' -> 'ko').
  try {
    const browserLang = navigator.language.split('-')[0] ?? ''
    if ((SUPPORTED_LANGUAGES as readonly string[]).includes(browserLang)) {
      return browserLang as SupportedLanguage
    }
  } catch {
    // navigator may be unavailable in some test environments.
  }

  // 3. Fallback.
  return DEFAULT_LANGUAGE
}

export interface UseLanguageResult {
  /** Currently active language code (e.g. 'en'). */
  language: SupportedLanguage
  /** Change the active language and persist the choice. */
  setLanguage: (lang: SupportedLanguage) => void
  /** All supported language codes. */
  languages: readonly SupportedLanguage[]
}

/**
 * Hook that wraps react-i18next's language management with:
 * - persistence to localStorage
 * - typed SupportedLanguage values
 * - a stable `languages` array
 */
export function useLanguage(): UseLanguageResult {
  const { i18n } = useTranslation()

  const language = (
    (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
      ? i18n.language
      : DEFAULT_LANGUAGE
  ) as SupportedLanguage

  const setLanguage = useCallback(
    (lang: SupportedLanguage) => {
      void i18n.changeLanguage(lang)
      try {
        localStorage.setItem(STORAGE_KEY, lang)
      } catch {
        // Ignore storage errors — language change still takes effect in-session.
      }
    },
    [i18n]
  )

  return {
    language,
    setLanguage,
    languages: SUPPORTED_LANGUAGES,
  }
}
