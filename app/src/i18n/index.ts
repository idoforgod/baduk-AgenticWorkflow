// =============================================================================
// Module: i18n — Public API Barrel Export
// =============================================================================
// Layer 1 (Infrastructure)
// Purpose: Internationalization (en/ko/ja) via i18next + react-i18next.
// Dependencies: core
//
// Supported locales: en (English), ko (Korean), ja (Japanese).
// Default locale: en (English-first per Step 6).
//
// Usage at app entry point:
//   import '@i18n'          // initializes i18next (side-effect import)
//
// Usage in components:
//   import { useLanguage } from '@i18n'
//   import { useTranslation } from 'react-i18next'
// =============================================================================

// Side-effect: initializes i18next with all bundled resources.
import './config'

export {
  DEFAULT_LANGUAGE,
  default as i18n,
  resources,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from './config'
export {
  detectInitialLanguage,
  type UseLanguageResult,
  useLanguage,
} from './useLanguage'
