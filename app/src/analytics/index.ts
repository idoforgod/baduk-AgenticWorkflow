// =============================================================================
// Module: analytics — Public API Barrel Export
// =============================================================================
// Layer 3 (Application)
// Purpose: PostHog event tracking, Sentry error reporting, and privacy controls.
// Dependencies: core
//
// Implemented by: Step 20 (integration-developer)
// Consumers: features/quick-go, App.tsx, settings screens
//
// All telemetry is:
//   - Anonymous: no PII, no IP, no move sequences
//   - Opt-in: disabled by default — user must explicitly enable
//   - Documented: see privacy.ts for data inventory and retention policy
// =============================================================================

// Consent management
export {
  getAnalyticsConsent,
  resetAnalyticsConsent,
  setAnalyticsConsent,
} from './consent'

// Event type definitions (types only — for compile-time safety)
export type {
  AnalyticsEvent,
  AnalyticsEventName,
  ExplanationViewedEvent,
  GameEndedEvent,
  GameStartedEvent,
  LanguageChangedEvent,
  OnboardingStepEvent,
  QuickGoPlayedEvent,
  SettingsChangedEvent,
} from './events'
export type { PostHogConfig } from './posthog-client'
// PostHog client
export { PostHogClient, posthogClient } from './posthog-client'
export type { AnalyticsDataExport, AnalyticsDataInventory } from './privacy'
// Privacy controls
export {
  clearAllAnalyticsData,
  exportAnalyticsDataSummary,
  getAnalyticsStatus,
} from './privacy'
export type { SentryConfig } from './sentry-client'
// Sentry crash reporting + React error boundary
export { SentryClient, SentryErrorBoundary, sanitizeString, sentryClient } from './sentry-client'
